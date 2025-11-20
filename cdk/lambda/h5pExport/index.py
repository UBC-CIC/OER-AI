import json
import zipfile
import base64
from pathlib import Path
from io import BytesIO
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def handler(event, context):
    """
    Lambda handler for H5P export
    Accepts question set JSON, generates .h5p file, returns as base64
    """
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        questions = body.get('questions', [])
        title = body.get('title', 'Generated Quiz')
        
        if not questions:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({'error': 'No questions provided'})
            }
        
        logger.info(f"Generating H5P package for '{title}' with {len(questions)} questions")
        
        # Generate H5P package (returns bytes)
        h5p_bytes = create_h5p_package(questions, title)
        
        # Encode as base64
        h5p_base64 = base64.b64encode(h5p_bytes).decode('utf-8')
        
        logger.info(f"H5P package created successfully, size: {len(h5p_bytes)} bytes")
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'filename': f"{title.replace(' ', '_')}.h5p",
                'content': h5p_base64,
                'size': len(h5p_bytes)
            })
        }
        
    except Exception as e:
        logger.error(f"Error generating H5P: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'error': f'Failed to generate H5P: {str(e)}'})
        }


def create_h5p_package(questions, title):
    """
    Create H5P package from question data
    Returns bytes of the .h5p file
    """
    # Create temp directory in Lambda's /tmp
    import time
    work_dir = Path(f"/tmp/h5p_{int(time.time() * 1000)}")
    content_dir = work_dir / "content"
    content_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Detect question type
        question_type = None
        if questions:
            library = questions[0].get("library", "")
            if library.startswith("H5P.Essay"):
                question_type = "essay"
            elif library.startswith("H5P.MultiChoice"):
                question_type = "mcq"
            else:
                raise ValueError(f"Unsupported question type: {library}")
        
        # Validate all questions are same type
        for q in questions:
            lib = q.get("library", "")
            if question_type == "essay" and not lib.startswith("H5P.Essay"):
                raise ValueError("Mixed question types not supported. All questions must be Essay type.")
            elif question_type == "mcq" and not lib.startswith("H5P.MultiChoice"):
                raise ValueError("Mixed question types not supported. All questions must be MCQ type.")
        
        # Determine if single or multiple questions
        use_question_set = len(questions) > 1
        
        # Build content.json based on question type
        if question_type == "essay":
            if not use_question_set:
                # Single Essay question
                q = questions[0]
                content_data = q["params"]
            else:
                # Multiple Essay questions - use QuestionSet
                question_set = []
                for q in questions:
                    question_set.append({
                        "library": "H5P.Essay 1.5",
                        "params": q["params"]
                    })
                content_data = {
                    "introduction": f"<p>{title}</p>",
                    "questions": question_set,
                    "behaviour": {
                        "enableRetry": True,
                        "enableSolutionsButton": True
                    },
                    "overallFeedback": [
                        {"from": 0, "to": 100, "feedback": "Good job!"}
                    ]
                }
        else:  # MCQ
            if not use_question_set:
                # Single question format
                q = questions[0]
                content_data = {
                    "question": q["params"]["question"],
                    "answers": q["params"]["answers"],
                    "behaviour": {
                        "enableRetry": True,
                        "enableSolutionsButton": True,
                        "singlePoint": True,
                        "randomAnswers": True
                    },
                    "l10n": {
                        "checkAnswer": "Check",
                        "showSolution": "Show solution",
                        "retry": "Try again"
                    }
                }
            else:
                # Multiple questions - use QuestionSet
                question_set = []
                for q in questions:
                    question_set.append({
                        "library": "H5P.MultiChoice 1.16",
                        "params": q["params"]
                    })
                content_data = {
                    "introduction": f"<p>{title}</p>",
                    "questions": question_set,
                    "behaviour": {
                        "enableRetry": True,
                        "enableSolutionsButton": True
                    },
                    "overallFeedback": [
                        {"from": 0, "to": 100, "feedback": "Good job!"}
                    ]
                }
        
        with open(content_dir / "content.json", "w") as f:
            json.dump(content_data, f, indent=2)
        
        # Build h5p.json (metadata)
        if question_type == "essay":
            main_library = "H5P.Essay" if not use_question_set else "H5P.QuestionSet"
        else:
            main_library = "H5P.MultiChoice" if not use_question_set else "H5P.QuestionSet"
        
        # Build dependency list
        dependencies = []
        if question_type == "essay":
            dependencies.append({
                "machineName": "H5P.Essay",
                "majorVersion": 1,
                "minorVersion": 5
            })
        else:
            dependencies.append({
                "machineName": "H5P.MultiChoice",
                "majorVersion": 1,
                "minorVersion": 16
            })
        
        # Add QuestionSet dependencies if needed
        if use_question_set:
            dependencies.insert(0, {
                "machineName": "H5P.QuestionSet",
                "majorVersion": 1,
                "minorVersion": 17
            })
        
        h5p_data = {
            "title": title,
            "language": "en",
            "mainLibrary": main_library,
            "embedTypes": ["div"],
            "license": "CC BY",
            "authors": [{"name": "OER-AI Assistant", "role": "Author"}],
            "preloadedDependencies": dependencies
        }
        with open(work_dir / "h5p.json", "w") as f:
            json.dump(h5p_data, f, indent=2)
        
        # Create ZIP file in memory (DO NOT include library.json - it's not needed at root)
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as h5p_zip:
            # Add h5p.json
            h5p_zip.write(work_dir / "h5p.json", "h5p.json")
            # Add content/content.json
            h5p_zip.write(content_dir / "content.json", "content/content.json")
        
        # Get bytes
        h5p_bytes = zip_buffer.getvalue()
        
        return h5p_bytes
        
    finally:
        # Cleanup temp directory
        import shutil
        if work_dir.exists():
            shutil.rmtree(work_dir)
