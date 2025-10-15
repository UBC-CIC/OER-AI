import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Textbook = {
  id: number;
  title: string;
  author: string[];
  category: string;
};

// Proper formatting of authors tags
function formatAuthors(authors: string[]) {
  if (!authors || authors.length === 0) return "Unknown";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  return authors.slice(0, -1).join(", ") + " & " + authors[authors.length - 1];
}

export default function TextbookCard({ textbook }: { textbook: Textbook }) {
  return (
    <Card
      key={textbook.id}
      className="flex flex-col items-start p-[10px] gap-4 not-odd:transition-shadow hover:shadow-lg"
    >
      <CardHeader className="flex-1 p-0 w-full">
        <CardTitle
          className="line-clamp-3 text-lg leading-[1.25] text-left overflow-hidden"
          style={{ minHeight: `calc(1em * 1.25 * 3)` }}
        >
          {textbook.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 w-full">
        <p className="truncate text-sm text-primary text-left">
          By {formatAuthors(textbook.author)}
        </p>
      </CardContent>
      <CardContent className="p-0 w-full">
        <p className="px-[10px] py-[5px] bg-primary text-primary-foreground border rounded-xl w-fit text-left">
          {textbook.category}
        </p>
      </CardContent>
    </Card>
  );
}
