"""
Scrapy Web Crawler for OER Textbook Processing
Crawls textbook links and outputs all discovered URLs
"""

import requests
import re
import boto3
import json
import pandas as pd
from bs4 import BeautifulSoup, NavigableString, Tag
from typing import List, Dict, Tuple
from collections import defaultdict
import psycopg2
import scrapy
import sys
import logging
from datetime import datetime
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_aws import BedrockEmbeddings
from langchain_postgres import PGVector
from langchain_core.documents import Document
from awsglue.utils import getResolvedOptions
from urllib.parse import urljoin, urlparse
import time


connection = None
db_secret = None
embeddings = None
vector_store = None

# Database configuration
DB_SECRET_NAME = None
RDS_PROXY_ENDPOINT = None
EMBEDDING_MODEL_ID = None

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


SENT_END_RE = re.compile(r"[\.!\?…»”'”\)]\s*$")
HEADING_LIKE_RE = re.compile(r"^[A-Z0-9][A-Za-z0-9 \-]{0,80}$")
TERM_RE = re.compile(r"[\.!\?…]['\"\)\]]*\s*$")

print("=== SCRAPY WEB CRAWLER START ===")

# Get job parameters
try:
    args = getResolvedOptions(sys.argv, [
        'batch_id',
        'sqs_message_id',
        'sqs_message_body',
        'trigger_timestamp',
        'region_name',
        'GLUE_BUCKET',
        'rds_secret',
        'rds_proxy_endpoint',
        'embedding_model_id'
    ])
    print("=== JOB PARAMETERS ===")
    for key, value in args.items():
        print(f"{key}: {value}")
        
    # Initialize database configuration
    DB_SECRET_NAME = args['rds_secret']
    RDS_PROXY_ENDPOINT = args['rds_proxy_endpoint']
    EMBEDDING_MODEL_ID = args['embedding_model_id']
        
    # Parse the SQS message body
    sqs_data = json.loads(args['sqs_message_body'])
    start_url = sqs_data['link']
    metadata = sqs_data['metadata']
    
    print(f"=== CRAWLING TARGET ===")
    print(f"Start URL: {start_url}")
    print(f"Book Title: {metadata.get('title', 'Unknown')}")
    print(f"Book ID: {metadata.get('bookId', 'Unknown')}")
    
except Exception as e:
    print(f"Error parsing arguments: {e}")
    sys.exit(1)


# Initialize AWS clients
secrets_manager = boto3.client("secretsmanager", region_name=args['region_name'])
ssm_client = boto3.client("ssm", region_name=args['region_name'])
s3_client = boto3.client("s3", region_name=args['region_name'])

def get_secret(secret_name, expect_json=True):
    global db_secret
    if db_secret is None:
        try:
            response = secrets_manager.get_secret_value(SecretId=secret_name)["SecretString"]
            db_secret = json.loads(response) if expect_json else response
        except Exception as e:
            logger.error(f"Error fetching secret: {e}")
            raise
    return db_secret

def get_parameter(param_name, cached_var):
    if cached_var is None and param_name:
        try:
            response = ssm_client.get_parameter(Name=param_name, WithDecryption=True)
            cached_var = response["Parameter"]["Value"]
        except Exception as e:
            logger.error(f"Error fetching parameter {param_name}: {e}")
            raise
    return cached_var

def connect_to_db():
    global connection
    if connection is None or connection.closed:
        try:
            secret = get_secret(DB_SECRET_NAME)
            connection = psycopg2.connect(
                dbname=secret["dbname"],
                user=secret["username"],
                password=secret["password"],
                host=RDS_PROXY_ENDPOINT,
                port=int(secret["port"])
            )
            logger.info("Connected to the database!")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise
    return connection

def initialize_embeddings_and_vectorstore(textbook_id, textbook_title):
    """
    Initialize Bedrock embeddings and PGVector store for the textbook.
    Returns the initialized vector store.
    """
    global embeddings, vector_store
    
    try:
        # Initialize Bedrock embeddings if not already done
        if embeddings is None:
            logger.info(f"Initializing Bedrock embeddings with model: {EMBEDDING_MODEL_ID}")
            embeddings = BedrockEmbeddings(
                model_id=EMBEDDING_MODEL_ID,
                region_name=args['region_name']
            )
            logger.info("Bedrock embeddings initialized successfully")
        
        # Get database connection info for vector store
        conn_info = get_secret(DB_SECRET_NAME)
        conn_str = (
            f"postgresql://{conn_info['username']}:{conn_info['password']}"
            f"@{RDS_PROXY_ENDPOINT}:{conn_info['port']}/{conn_info['dbname']}"
        )
        
        # Initialize PGVector store
        logger.info(f"Initializing PGVector store for textbook ID: {textbook_id}")
        vector_store = PGVector(
            embeddings=embeddings,
            collection_name=str(textbook_id),
            collection_metadata={'title': textbook_title},
            connection=conn_str,
            use_jsonb=True
        )
        logger.info("PGVector store initialized successfully")
        
        return vector_store
        
    except Exception as e:
        logger.error(f"Error initializing embeddings and vector store: {e}")
        raise

def fetch_page(url):
    response = requests.get(url)
    response.raise_for_status()
    return BeautifulSoup(response.content, "html.parser")

def _text_with_lists(elem):
    """
    Produce readable plain text from an element while preserving paragraphs
    and lists (ordered/unordered).
    """
    parts = []
    for child in elem.children:
        if getattr(child, "name", None) is None:
            text = child.strip()
            if text:
                parts.append(text)
            continue

        name = child.name.lower()
        if name in ("p", "div", "span", "h3", "h4"):
            t = child.get_text(separator=" ", strip=True)
            if t:
                parts.append(t)
        elif name in ("ol", "ul"):
            # enumerate items for ol, bullet for ul
            is_ordered = (name == "ol")
            for i, li in enumerate(child.find_all("li", recursive=False), start=1):
                li_text = li.get_text(separator=" ", strip=True)
                if is_ordered:
                    parts.append(f"{i}. {li_text}")
                else:
                    parts.append(f"- {li_text}")
        else:
            # fallback: text inside the child
            t = child.get_text(separator=" ", strip=True)
            if t:
                parts.append(t)
    return "\n".join(parts).strip()
def extract_chapters(soup):
    chapters = []

    # Find TOC container
    toc = soup.select('ol', {'class': 'toc'})
    bs = BeautifulSoup(str(toc[0]), "html.parser")
    if not toc:
        return chapters

    # Find all TOC links
    links = bs.find_all('a')

    for link in links:
        title = link.get_text(strip=True)
        href = link.get('href')
        chapters.append({'title': title, 'link': href})

    return chapters

def extract_metadata(soup):
    metadata = {}

    # Look for the metadata block
    metadata_section = soup.find('dl', class_='block-meta__list')
    if not metadata_section:
        return metadata  # Return empty if metadata section not found

    # Loop through all <div class="block-meta__subsection">
    for subsection in metadata_section.find_all('div', class_='block-meta__subsection'):
        title_tag = subsection.find('dt')
        content_tag = subsection.find('dd')
        
        if title_tag and content_tag:
            # Get clean text from both title and content
            title = title_tag.get_text(strip=True)
            content = content_tag.get_text(separator=' ', strip=True)
            metadata[title] = content

    return metadata

def extract_license_url(soup):
    """
    Extracts the license URL (e.g. Creative Commons link) 
    from a section or div containing the license info.
    Returns the URL string or None if not found.
    """
    # Find the license block
    license_block = soup.find('div', class_='block-info__subsection block-info__license')
    if not license_block:
        # fallback if classnames are partial or split
        license_block = soup.find('div', class_=lambda c: c and 'block-info__license' in c)
    if not license_block:
        return None

    # Find the <a> tag with rel="license" (most reliable)
    license_link = license_block.find('a', rel=lambda val: val and 'license' in val)
    if license_link and license_link.get('href'):
        return license_link['href']

    # Fallback: look for a link that looks like a Creative Commons URL
    for a in license_block.find_all('a', href=True):
        if 'creativecommons.org' in a['href'] or '/licenses/' in a['href']:
            return a['href']

    return None

def extract_book_information(soup):
    """
    Returns a dict with keys:
      - 'description': plain text preserving paragraphs/lists (or None)
      - 'license': dict with keys 'license_name', 'license_url',
                   'title', 'title_url', 'attribution_names', 'icon_url', 'raw_text'
    """
    result = {
        "description": None,
        "license_url": None
    }

    # Prefer the container with id="block-info" or any section with class block-info
    container = soup.find(id="block-info")
    if not container:
        container = soup.find("section", class_="block-info")
    if not container:
        # fallback: search entire soup
        container = soup

    # DESCRIPTION
    desc_block = container.find("div", class_="block-info__subsection block-info__description")
    if not desc_block:
        # sometimes class names may be split, try partial match
        desc_block = container.find("div", class_=lambda c: c and "block-info__description" in c)
    if desc_block:
        # remove the heading if present, then render text preserving lists
        # the description content usually follows an <h3> or similar
        # find the inner container where paragraphs/lists live
        inner = desc_block
        # if there is a specific wrapper, use it
        # gather all content after the subtitle header
        subtitle = inner.find(lambda tag: tag.name and tag.name.startswith("h") and "Book Description" in tag.get_text())
        if subtitle:
            # gather siblings after subtitle
            pieces = []
            for sib in subtitle.find_next_siblings():
                pieces.append(sib)
            # create a temporary tag to hold them for _text_with_lists
            tmp = BeautifulSoup("<div></div>", "html.parser").div
            for p in pieces:
                tmp.append(p)
            result["description"] = _text_with_lists(tmp) or None
        else:
            # no subtitle; just process whole block
            result["description"] = _text_with_lists(inner) or None
    result['license_url'] = extract_license_url(soup)

    return result

# --- Helpers -------------------------------------------------------------
def render_table_markdown(table: Tag) -> str:
    caption_tag = table.find('caption')
    caption = caption_tag.get_text(" ", strip=True) if caption_tag else ''
    # headers: prefer <thead> or first <tr> with <th>
    headers = []
    thead = table.find('thead')
    if thead:
        headers = [th.get_text(" ", strip=True) for th in thead.find_all(['th','td'])]
    else:
        first_tr = table.find('tr')
        if first_tr:
            headers = [c.get_text(" ", strip=True) for c in first_tr.find_all('th')]
    # rows: every tr -> list of cell texts
    rows = []
    for tr in table.find_all('tr'):
        cells = [c.get_text(" ", strip=True) for c in tr.find_all(['td','th'])]
        if cells:
            rows.append(cells)
    # if headers were taken from first row, avoid duplicating it
    if headers and rows and all(h==r for h,r in zip(headers, rows[0])):
        rows = rows[1:]
    lines = []
    if caption:
        lines.append(f"[Table: {caption}]")
    if headers:
        lines.append("| " + " | ".join(headers) + " |")
        lines.append("| " + " | ".join(["---"]*len(headers)) + " |")
    for r in rows:
        lines.append("| " + " | ".join(r) + " |")
    return "\n".join(lines)

def extract_media(section):
    media = {
        'images': [],
        'videos': [],
        'audio': [],
        'iframes': [],
        'files': [],
        'embeds': [],
        'links': []   # NEW: all hyperlinks, including internal/external/mailto/tel
    }

    # ----- Images -----
    for fig in section.find_all('figure'):
        img = fig.find('img')
        cap = fig.find('figcaption')
        media['images'].append({
            'src': (img.get('src') if img else None),
            'alt': (img.get('alt') if img else None),
            'href': (fig.find('a').get('href') if fig.find('a') else None),
            'caption': (cap.get_text(" ", strip=True) if cap else None)
        })

    for img in section.find_all('img'):
        src = img.get('src') or img.get('data-src') or img.get('data-original')
        if src and not any(x.get('src') == src for x in media['images']):
            media['images'].append({
                'src': src,
                'alt': img.get('alt', ''),
                'href': None,
                'caption': None
            })

    # ----- Videos -----
    for vid in section.find_all('video'):
        media['videos'].append({
            'src': vid.get('src'),
            'poster': vid.get('poster'),
            'controls': vid.has_attr('controls'),
            'sources': [s.get('src') for s in vid.find_all('source') if s.get('src')]
        })

    # ----- Audio -----
    for aud in section.find_all('audio'):
        media['audio'].append({
            'src': aud.get('src'),
            'controls': aud.has_attr('controls'),
            'sources': [s.get('src') for s in aud.find_all('source') if s.get('src')]
        })

    # ----- Iframes -----
    for frame in section.find_all('iframe'):
        media['iframes'].append({
            'src': frame.get('src'),
            'title': frame.get('title'),
            'width': frame.get('width'),
            'height': frame.get('height')
        })

    # ----- Files (known downloadable extensions) -----
    file_extensions = (
        '.pdf', '.doc', '.docx', '.xls', '.xlsx',
        '.zip', '.rar', '.ppt', '.pptx', '.epub', '.txt'
    )

    for a in section.find_all('a', href=True):
        href = a['href'].strip()
        text = a.get_text(" ", strip=True) or None
        title = a.get('title')
        download = a.get('download')

        # 1️⃣ Capture downloadable files
        if any(href.lower().endswith(ext) for ext in file_extensions):
            media['files'].append({
                'href': href,
                'text': text,
                'title': title,
                'download': download,
                'type': href.split('.')[-1].lower()
            })

        # 2️⃣ Capture ALL links (mailto, tel, external, internal, etc.)
        if not any(x['href'] == href for x in media['links']):
            media['links'].append({
                'href': href,
                'text': text,
                'title': title,
                'target': a.get('target'),
                'rel': a.get('rel'),
                'download': download
            })

    # ----- Embeds (legacy/flash) -----
    for emb in section.find_all('embed'):
        media['embeds'].append({
            'src': emb.get('src'),
            'type': emb.get('type')
        })

    return media

    
def extract_chapter_with_tables_and_media(soup):
    """
    Extract a single text block for the chapter while preserving
    natural breaks by scanning relevant tags in document order.
    Returns (text_block: str, media: dict).
    """
    section = soup.find('section') or soup.find(class_='chapter')
    if not section:
        return "", []

    # Collect media separately
    media = extract_media(section)

    # Which tags we consider as "blocks" we want to preserve
    # (we'll handle more specific items first and avoid processing
    # parent containers that contain these higher-priority children)
    block_tags = {
        # highest-priority content elements
        'table', 'figure', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'blockquote', 'pre',
        'caption', 'iframe', 'img',
        # container elements (lower priority)
        'div', 'section', 'article', 'aside'
    }

    # If a container has any of these high-priority child tags,
    # prefer children; treat these as high-priority for skipping containers
    high_priority_children = {
        'table', 'figure', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'ul', 'ol', 'li', 'dl', 'blockquote', 'pre', 'iframe', 'img'
    }

    processed_parents = set()
    text_blocks = []

    # Iterate through tags in document order
    for tag in section.find_all(block_tags, recursive=True):
        # skip non-tags just in case
        if not isinstance(tag, Tag):
            continue

        # If an ancestor is already processed, skip this tag (to avoid duplication)
        if any(parent in processed_parents for parent in tag.parents):
            continue

        # If this is a container (div/section/article/aside) that contains
        # any high-priority children, skip processing the container itself
        if tag.name in ('div', 'section', 'article', 'aside'):
            if tag.find(lambda t: t.name in high_priority_children, recursive=True):
                continue

        # Now handle each tag type
        name = tag.name.lower()

        if name in ('h1','h2','h3','h4','h5','h6'):
            heading_text = tag.get_text(" ", strip=True)
            if heading_text:
                text_blocks.append(heading_text)

        elif name == 'p':
            ptxt = tag.get_text(" ", strip=True)
            if ptxt:
                text_blocks.append(ptxt)

        elif name in ('ul', 'ol'):
            # Only take direct li children so nested lists are preserved properly
            items = []
            for li in tag.find_all('li', recursive=False):
                item_text = li.get_text(" ", strip=True)
                if item_text:
                    items.append("- " + item_text)
            if items:
                text_blocks.append("\n".join(items))

        elif name == 'li':
            # This handles stray li elements not already captured by ul/ol above
            li_text = tag.get_text(" ", strip=True)
            if li_text:
                text_blocks.append("- " + li_text)

        elif name == 'dl':
            dl_parts = []
            cur_dt = None
            for el in tag.children:
                if not isinstance(el, Tag):
                    continue
                if el.name == 'dt':
                    cur_dt = el.get_text(" ", strip=True)
                elif el.name == 'dd':
                    dd_text = el.get_text(" ", strip=True)
                    if cur_dt:
                        dl_parts.append(f"{cur_dt}: {dd_text}")
                        cur_dt = None
                    else:
                        dl_parts.append(dd_text)
            if dl_parts:
                text_blocks.append("\n\n".join(dl_parts))

        elif name == 'blockquote':
            bq = tag.get_text("\n", strip=True)
            if bq:
                text_blocks.append(bq)

        elif name == 'pre':
            pre_text = tag.get_text("\n", strip=True)
            if pre_text:
                text_blocks.append(pre_text)

        elif name == 'figure':
            parts = []
            # captions
            caption = tag.find('figcaption')
            if caption:
                captxt = caption.get_text(" ", strip=True)
                if captxt:
                    parts.append(captxt)
            # images (alt/title)
            for img in tag.find_all('img'):
                alt = img.get('alt') or img.get('title') or ""
                if alt:
                    parts.append(alt)
                # also include src in parentheses if no alt
                if not alt and img.get('src'):
                    parts.append(img.get('src'))

            combined = "\n".join([p for p in parts if p])
            if combined:
                text_blocks.append(combined)

        elif name == 'figcaption' or name == 'caption':
            captxt = tag.get_text(" ", strip=True)
            if captxt:
                text_blocks.append(captxt)

        elif name == 'table':
            # Render table via helper, fallback to plain text
            try:
                table_md = render_table_markdown(tag)
            except Exception:
                table_md = tag.get_text("\t", strip=True)
            if table_md:
                text_blocks.append(table_md)

        elif name == 'iframe':
            # capture iframe src/title as a small block so embedded content is not lost
            src = tag.get('src') or tag.get('data-src')
            title = tag.get('title') or ''
            info = "Embedded content"
            if title:
                info += f": {title}"
            if src:
                info += f" ({src})"
            text_blocks.append(info)

        elif name == 'img':
            # capture stray images not in figures (use alt or src)
            alt = tag.get('alt') or tag.get('title') or ''
            src = tag.get('src') or tag.get('data-src') or tag.get('data-original') or ''
            if alt:
                text_blocks.append(alt)
            elif src:
                text_blocks.append(src)

        else:
            # fallback: small amount of text from tag
            txt = tag.get_text(" ", strip=True)
            if txt:
                text_blocks.append(txt)

        # mark this tag as processed to avoid re-processing descendants/ancestors later
        processed_parents.add(tag)

    # Additionally, capture any top-level stray NavigableStrings between tags (rare),
    # but only those not inside <script> or <style> or empty whitespace.
    stray_texts = []
    for node in section.descendants:
        if isinstance(node, NavigableString):
            parent = getattr(node, 'parent', None)
            if not parent or parent.name in ('script', 'style'):
                continue
            text = str(node).strip()
            if text:
                # ignore if the parent was already collected
                if not any(parent is p or parent in p.parents for p in processed_parents):
                    stray_texts.append(text)

    # Add stray texts but keep them after the block elements to avoid duplication in order
    # (they are often inline text fragments; join them as one block)
    if stray_texts:
        # filter duplicates and short repeated fragments
        joined_strays = " ".join(dict.fromkeys(stray_texts))
        if joined_strays.strip():
            text_blocks.append(joined_strays.strip())

    # Final cleanup: remove empty blocks, normalize whitespace, preserve double-newline
    cleaned_blocks = []
    for b in text_blocks:
        # replace multiple spaces with single (but keep newlines)
        tmp = re.sub(r'[ \t]+', ' ', b)
        tmp = re.sub(r'\s+\n', '\n', tmp)
        tmp = re.sub(r'\n{3,}', '\n\n', tmp)
        tmp = tmp.strip()
        if tmp:
            cleaned_blocks.append(tmp)

    # join blocks into one text body with paragraph separation preserved
    final_text = "\n\n".join(cleaned_blocks)
    # final normalization
    final_text = re.sub(r'\n{3,}', '\n\n', final_text).strip()

    return final_text, media

def reflow_newline_text(text):
    """
    Convert newline-only text into paragraphs:
    - Preserve explicit blank lines (one or more consecutive newlines) as paragraph breaks.
    - Join soft-wrapped lines into a single paragraph if the line DOES NOT end with terminal punctuation
      and the next line begins with lowercase OR is not heading-like.
    - Keep lines that look like headings (short, Title Case or ALL CAPS) as their own paragraph.
    """
    # normalize newlines
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = text.split("\n")
    paragraphs = []
    cur = []

    def flush_cur():
        if cur:
            paragraphs.append(" ".join(cur).strip())
            cur.clear()

    for i, line in enumerate(lines):
        ln = line.strip()
        # If blank line -> paragraph boundary
        if ln == "":
            flush_cur()
            continue

        # If line looks like a heading (short, title-case or all-caps), keep as its own paragraph
        is_heading_like = False
        # count words and uppercase ratio heuristic
        words = ln.split()
        if 1 <= len(words) <= 8 and (ln.isupper() or HEADING_LIKE_RE.match(ln)):
            is_heading_like = True

        # Lookahead
        nxt = lines[i+1].strip() if i+1 < len(lines) else ""
        nxt_starts_lower = bool(nxt) and nxt[0].islower()
        cur_ends_with_sentence = bool(SENT_END_RE.search(ln))

        if is_heading_like:
            # treat heading as separate paragraph
            flush_cur()
            paragraphs.append(ln)
            continue

        # If this line ends with sentence punctuation -> keep as sentence boundary
        if cur_ends_with_sentence:
            cur.append(ln)
            flush_cur()
            continue

        # If next line is blank -> end paragraph here
        if nxt == "":
            cur.append(ln)
            flush_cur()
            continue

        # If next line starts lowercase -> probably continuation of sentence/paragraph -> join
        if nxt_starts_lower:
            cur.append(ln)
            continue

        # Otherwise, ambiguous: we choose to join short lines (soft wrap) and break on longer lines
        if len(ln) < 80:
            cur.append(ln)
            continue
        else:
            # long line, treat as end-of-line (start new paragraph)
            cur.append(ln)
            flush_cur()
            continue

    flush_cur()
    # return text with explicit paragraph separators
    return "\n\n".join(p for p in paragraphs if p)

def ends_with_terminal(text: str) -> bool:
    return bool(TERM_RE.search(text.strip()))

def _get_text_and_meta(doc):
    """
    Support either a LangChain Document-like object (has .page_content / .metadata)
    or a dict with 'text' / 'page_content' and 'metadata' keys.
    """
    if hasattr(doc, "page_content"):
        text = doc.page_content
        meta = getattr(doc, "metadata", {}) or {}
    else:
        # dict-like
        text = doc.get("page_content") or doc.get("text") or ""
        meta = doc.get("metadata", {}) or {}
    return text, meta

def execute_query(query, params=None, fetch_one=False):
    """Execute a database query and return results"""
    conn = None
    cursor = None
    try:
        conn = connect_to_db()
        cursor = conn.cursor()
        cursor.execute(query, params)
        
        if fetch_one:
            result = cursor.fetchone()
        else:
            result = cursor.fetchall() if cursor.description else None
            
        conn.commit()
        return result
        
    except Exception as e:
        logger.error(f"Database query error: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()

def postprocess_documents(docs, min_chars=600):
    """
    docs: list of langchain Document objects or dicts {'page_content'/'text':..., 'metadata':...}
    - Merge tiny chunks with the following chunk.
    - If a chunk ends mid-sentence (no terminal punctuation), merge with next.
    - IMPORTANT: Do NOT combine or mutate metadata from merged chunks.
      The metadata for a merged chunk will be the metadata of the *first* chunk in the merge.
    - Return list of cleaned {'text':..., 'metadata':...}
    """
    cleaned = []
    i = 0
    L = len(docs)

    while i < L:
        cur_text, cur_meta = _get_text_and_meta(docs[i])
        cur_text = (cur_text or "").strip()

        # If chunk is too small or likely ends mid-sentence, merge forward with next chunk(s)
        if (len(cur_text) < min_chars or not ends_with_terminal(cur_text)) and i + 1 < L:
            # merge with next chunk only (you can extend to merge more ahead if desired)
            next_text, _ = _get_text_and_meta(docs[i + 1])
            merged_text = (cur_text + " " + (next_text or "")).strip()
            # Keep metadata of the first chunk in the merge (do not combine metadata)
            cleaned.append(Document(page_content=merged_text, metadata=dict(cur_meta)))
            i += 2
            continue
        else:
            cleaned.append(Document(page_content=cur_text, metadata=dict(cur_meta)))
            i += 1

    # Deduplicate near-duplicates (simple fingerprint)
    unique = []
    seen = set()
    for c in cleaned:
        key = c.page_content[:200]
        if key in seen:
            continue
        seen.add(key)
        unique.append(c)

    return unique

def process_chapters_to_vectors(extracted_chapters, vector_store, s3_bucket, textbook_id):
    """
    Process extracted chapters into text chunks and store as vector embeddings.
    """
    try:
        logger.info(f"Processing {len(extracted_chapters)} chapters into vector embeddings...")
        
        # Initialize text splitter with your configuration
        text_splitter = RecursiveCharacterTextSplitter(
            separators=[
                "\n\n",    # paragraphs (we created these)
                "\n",      # single-line (fallback)
                ". ",      # sentence fallback
                " ",       # word fallback
                ""         # char fallback
            ],
            chunk_size=1200,      # ~200-350 tokens
            chunk_overlap=200,    # ~15-20% overlap
            length_function=len,
            is_separator_regex=False
        )
        
        for i, chapter in enumerate(extracted_chapters, 1):
            try:
                # Read the chapter text from S3
                logger.info(f"Processing chapter {i}/{len(extracted_chapters)}: {chapter['s3_key']}")
                
                response = s3_client.get_object(Bucket=s3_bucket, Key=chapter['s3_key'])
                chapter_text = response['Body'].read().decode('utf-8')
                
                if not chapter_text.strip():
                    logger.warning(f"Empty text for chapter: {chapter['s3_key']}")
                    continue
                
                # Insert section into database
                section_id = None
                try:
                    query = """
                    INSERT INTO sections (textbook_id, title, order_index, source_url)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id;
                    """
                    params = (textbook_id, chapter['metadata']['source_title'], i, chapter['metadata']['source'])
                    result = execute_query(query, params=params, fetch_one=True)
                    section_id = result[0] if result else None
                    logger.info(f"Created section with ID: {section_id}")
                except Exception as e:
                    logger.error(f"Error creating section for chapter {i}: {e}")
                    # Continue without section_id if database insertion fails
                
                # Apply text reflow to improve readability
                reflowed_text = reflow_newline_text(chapter_text)
                
                # Create documents from reflowed text
                doc_chunks = text_splitter.create_documents([reflowed_text])
                
                # Add metadata to each chunk
                for chunk in doc_chunks:
                    chunk.metadata.update({
                        'source': chapter['metadata']['source'],
                        'source_title': chapter['metadata']['source_title'],
                        'chapter_number': i,
                        's3_key': chapter['s3_key'],
                        'media': chapter['metadata']['media']
                    })
                    
                    # Add section_id if we successfully created the section
                    if section_id:
                        chunk.metadata['section_id'] = section_id
                
                # Post-process and add to vector store immediately for this chapter
                cleaned_chunks = postprocess_documents(doc_chunks, min_chars=600)
                
                if cleaned_chunks:
                    try:
                        vector_store.add_documents(cleaned_chunks)
                        logger.info(f"Added {len(cleaned_chunks)} processed chunks to vector store for chapter: {chapter['metadata']['source_title']}")
                    except Exception as e:
                        logger.error(f"Error adding chunks to vector store for chapter {chapter['metadata']['source_title']}: {e}")
                        # Continue processing other chapters even if vector store fails
                else:
                    logger.warning(f"No chunks to add for chapter: {chapter['metadata']['source_title']}")
                
            except Exception as e:
                logger.error(f"Error processing chapter {chapter['s3_key']}: {e}")
                continue
        
        logger.info(f"Vector processing complete! Processed {len(extracted_chapters)} chapters individually")
        
    except Exception as e:
        logger.error(f"Error in vector processing: {e}")
        raise

def upload_to_s3(content, s3_key, bucket_name, content_type='text/plain'):
    """Upload content to S3 and return the S3 key"""
    try:
        if isinstance(content, str):
            body = content.encode('utf-8')
        else:
            body = content
            
        s3_client.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=body,
            ContentType=content_type
        )
        logger.info(f"Successfully uploaded to S3: s3://{bucket_name}/{s3_key}")
        return s3_key
    except Exception as e:
        logger.error(f"Failed to upload to S3: {e}")
        raise

def download_image(image_url, base_url):
    """Download image from URL and return binary content and content type"""
    try:
        # Make URL absolute if it's relative
        full_url = urljoin(base_url, image_url)
        
        # Add headers to mimic a browser request
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(full_url, headers=headers, timeout=30)
        response.raise_for_status()
        
        # Determine content type
        content_type = response.headers.get('content-type', 'image/jpeg')
        
        return response.content, content_type, full_url
        
    except Exception as e:
        logger.warning(f"Failed to download image {image_url}: {e}")
        return None, None, None

def get_image_extension(content_type, url):
    """Get appropriate file extension based on content type or URL"""
    if 'jpeg' in content_type or 'jpg' in content_type:
        return '.jpg'
    elif 'png' in content_type:
        return '.png'
    elif 'gif' in content_type:
        return '.gif'
    elif 'webp' in content_type:
        return '.webp'
    elif 'svg' in content_type:
        return '.svg'
    else:
        # Try to get extension from URL
        parsed_url = urlparse(url)
        path = parsed_url.path.lower()
        if path.endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg')):
            return path[path.rfind('.'):]
        else:
            return '.jpg'  # Default fallback

def sanitize_filename(text):
    """Sanitize text to be safe for use as filename"""
    # Remove or replace problematic characters
    sanitized = re.sub(r'[<>:"/\\|?*]', '_', text)
    sanitized = re.sub(r'\s+', '_', sanitized)
    sanitized = sanitized.strip('._')
    return sanitized[:100]  # Limit length

def process_chapter(chapter_url, base_url, book_metadata):
    """Process a single chapter and return text content and metadata"""
    try:
        logger.info(f"Processing chapter: {chapter_url}")
        
        # Make URL absolute if it's relative
        full_url = urljoin(base_url, chapter_url)
        
        # Fetch and parse the chapter page
        soup = fetch_page(full_url)
        
        # Extract chapter content and media
        chapter_text, media = extract_chapter_with_tables_and_media(soup)
        
        if not chapter_text.strip():
            logger.warning(f"No text content found for chapter: {full_url}")
            return None
        
        # Extract chapter title from the page or URL
        title_tag = soup.find('title')
        chapter_title = title_tag.get_text(strip=True) if title_tag else "Untitled Chapter"
        
        # Try to get a better title from h1 or main heading
        h1_tag = soup.find('h1')
        if h1_tag:
            h1_text = h1_tag.get_text(strip=True)
            if h1_text and len(h1_text) < 200:
                chapter_title = h1_text
        
        chapter_metadata = {
            'url': full_url,
            'title': chapter_title,
            'book_id': book_metadata.get('bookId'),
            'book_title': book_metadata.get('title'),
            'processed_at': datetime.now().isoformat(),
            'media_count': {
                'images': len(media.get('images', [])),
                'videos': len(media.get('videos', [])),
                'audio': len(media.get('audio', [])),
                'iframes': len(media.get('iframes', [])),
                'files': len(media.get('files', [])),
                'links': len(media.get('links', []))
            }
        }
        
        return {
            'text': chapter_text,
            'metadata': chapter_metadata,
            'media': media
        }
        
    except Exception as e:
        logger.error(f"Error processing chapter {chapter_url}: {e}")
        return None

def extract_text(start_url, combined_metadata, s3_bucket):
    """
    Extract text from textbook chapters and upload to S3.
    Returns tuple of (extracted_chapters, image_sources).
    """
    logger.info("Starting text extraction...")
    
    # Fetch the main textbook page
    soup = fetch_page(start_url)
    
    logger.info(f"Book metadata: {json.dumps(combined_metadata, indent=2)}")
    
    # Extract chapters from table of contents
    chapters = extract_chapters(soup)
    logger.info(f"Found {len(chapters)} chapters")
    
    if not chapters:
        logger.warning("No chapters found in the textbook")
        return [], []
    
    # Process each chapter
    extracted_chapters = []
    all_image_sources = []
    base_prefix = 'processed-textbooks'
    book_id = combined_metadata.get('bookId', 'unknown')
    book_title_safe = sanitize_filename(combined_metadata.get('title', 'unknown'))
    
    for i, chapter in enumerate(chapters, 1):
        chapter_data = process_chapter(chapter['link'], start_url, combined_metadata)
        
        if chapter_data:
            # Create S3 directory for this chapter
            chapter_title_safe = sanitize_filename(chapter['title'])
            chapter_s3_prefix = f"{base_prefix}/{book_id}/{book_title_safe}/{chapter_title_safe}"
            
            # Upload chapter text to S3
            text_s3_key = f"{chapter_s3_prefix}/extracted.txt"
            uploaded_text_key = upload_to_s3(chapter_data['text'], text_s3_key, s3_bucket)
            
            # Collect image sources from this chapter
            chapter_images = []
            for img in chapter_data['media'].get('images', []):
                if img.get('src'):
                    chapter_images.append(img['src'])
            all_image_sources.extend(chapter_images)
            
            # Create chapter result with required metadata structure
            chapter_result = {
                's3_key': uploaded_text_key,
                'metadata': {
                    'source': chapter_data['metadata']['url'],
                    'source_title': chapter_data['metadata']['title'],
                    'media': chapter_data['media']
                },
                # Additional useful information
                'chapter_number': i,
                'text_length': len(chapter_data['text']),
                's3_prefix': chapter_s3_prefix
            }
            
            extracted_chapters.append(chapter_result)
            
            logger.info(f"Extracted chapter {i}/{len(chapters)}: {chapter_data['metadata']['title']} ({len(chapter_images)} images)")
    
    logger.info(f"Text extraction complete! Processed {len(extracted_chapters)} chapters with {len(all_image_sources)} total images")
    return extracted_chapters, all_image_sources

def main():
    """Main function to orchestrate textbook processing"""
    try:
        logger.info("Starting textbook processing...")
        s3_bucket = args['GLUE_BUCKET']
        logger.info(f"Using S3 bucket: {s3_bucket}")
        
        # First, fetch the main textbook page to get complete metadata
        soup = fetch_page(start_url)
        book_info = extract_book_information(soup)
        book_metadata_full = extract_metadata(soup)
        
        # Combine metadata
        combined_metadata = {**metadata, **book_metadata_full}
        combined_metadata.update(book_info)
        book_id = metadata.get('bookId', 'unknown')
        
        logger.info(f"Combined metadata: {json.dumps(combined_metadata, indent=2, default=str)}")
        # Insert textbook into database
        logger.info("Inserting textbook into database...")
        textbook_id = None
        conn = None
        cursor = None
        try:
            conn = connect_to_db()
            cursor = conn.cursor()
            
            query = """
            INSERT INTO textbooks (title, authors, license, source_url, publisher, publish_date, summary, language, level, metadata)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
            """
            
            # Parse authors from metadata
            authors_str = combined_metadata.get('Author', '')
            authors = [a.strip() for a in authors_str.split(",")] if authors_str else []
            
            # Parse publication date
            pub_date_str = combined_metadata.get('Publication Date', '')
            pub_date = None
            if pub_date_str:
                try:
                    pub_date = datetime.strptime(pub_date_str, "%B %d, %Y").date()
                except ValueError:
                    logger.warning(f"Could not parse publication date: {pub_date_str}")
            
            # Prepare additional metadata
            additional_metadata = {
                'publisher_city': combined_metadata.get('Publisher City'),
                'ebook_isbn': combined_metadata.get('Ebook ISBN'),
                'print_isbn': combined_metadata.get('Print ISBN'),
                'original_metadata': combined_metadata,
                'bookId': book_id
            }
            
            params = (
                combined_metadata.get('Title', 'Unknown Title'),
                authors,
                book_info.get('license_url'),
                start_url,
                combined_metadata.get('Publisher'),
                pub_date,
                book_info.get('description'),
                'English',
                combined_metadata.get('Primary Subject'),
                json.dumps(additional_metadata)
            )
            
            cursor.execute(query, params)
            textbook_id = cursor.fetchone()[0]
            conn.commit()
            
            logger.info(f"Successfully inserted textbook with ID: {textbook_id}")
            
            # Update metadata with textbook ID
            combined_metadata['textbook_id'] = textbook_id
            
            # Initialize embeddings and vector store for this textbook
            try:
                vector_store = initialize_embeddings_and_vectorstore(
                    textbook_id, 
                    combined_metadata.get('Title', 'Unknown Title')
                )
            except Exception as e:
                logger.error(f"Error initializing vector store: {e}")
                vector_store = None
            
        except Exception as e:
            logger.error(f"Error inserting textbook into database: {e}")
            if conn:
                conn.rollback()
            logger.info("Continuing without database insertion...")
        finally:
            if cursor:
                cursor.close()
        
        # Extract text from all chapters
        extracted_chapters, image_sources = extract_text(start_url, combined_metadata, s3_bucket)
        
        # Process chapters into vector embeddings if we have a vector store
        if vector_store and extracted_chapters:
            logger.info("Processing chapters into vector embeddings...")
            try:
                process_chapters_to_vectors(extracted_chapters, vector_store, s3_bucket, textbook_id)
            except Exception as e:
                logger.error(f"Error processing chapters to vectors: {e}")
                # Continue to show results even if vector processing fails
        
        if not extracted_chapters:
            logger.warning("No chapters were successfully processed")
            return
        
        # Print final results
        print("=== PROCESSING RESULTS ===")
        print(f"Book: {metadata.get('title', 'Unknown')}")
        print(f"Textbook ID: {textbook_id}")
        print(f"Chapters processed: {len(extracted_chapters)}")
        print(f"Image sources found: {len(image_sources)}")
        print(f"S3 bucket: {s3_bucket}")
        
        # Create base prefix for S3 keys
        base_prefix = 'processed-textbooks'
        book_id = metadata.get('bookId', 'unknown')
        print(f"S3 prefix: {base_prefix}/{book_id}")
        
        # Collect all S3 keys from extracted chapters
        all_s3_keys = [chapter['s3_key'] for chapter in extracted_chapters]
        
        print("Files uploaded:")
        for key in all_s3_keys:
            print(f"  - s3://{s3_bucket}/{key}")
        if image_sources:
            print("Image sources:")
            for img_src in image_sources[:10]:  # Show first 10 to avoid too much output
                print(f"  - {img_src}")
            if len(image_sources) > 10:
                print(f"  ... and {len(image_sources) - 10} more images")
        
    except Exception as e:
        logger.error(f"Error in main processing: {e}")
        raise

if __name__ == "__main__":
    main()