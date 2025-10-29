import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface GenerateFormProps {
  onGenerate: (formData: any) => void;
}

export function GenerateForm({ onGenerate }: GenerateFormProps) {
  const [materialType, setMaterialType] = useState("mcq");
  const [topic, setTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState("5");
  const [numOptions, setNumOptions] = useState("4");
  const [difficulty, setDifficulty] = useState("intermediate");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    //generation logic handled my parent
    onGenerate({
      materialType,
      topic,
      numQuestions: parseInt(numQuestions),
      numOptions: parseInt(numOptions),
      difficulty,
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-medium">
          Generate Practice Materials
        </CardTitle>
        <CardDescription>
          Fill out the details below to generate practice materials around the
          currently selected book
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="material-type">Material Type</Label>
            <Select value={materialType} onValueChange={setMaterialType}>
              <SelectTrigger className="border-grey w-full" id="material-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mcq">Multiple Choice Questions</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Topic */}
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <Input
              id="topic"
              placeholder="Describe a topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
            />
          </div>

          {/* Conditional Fields based on Material Type */}
          {materialType === "mcq" && (
            <>
              {/* Number of Questions */}
              <div className="space-y-2">
                <Label htmlFor="num-questions">Number of Questions</Label>
                <Input
                  id="num-questions"
                  type="number"
                  placeholder="Enter a number"
                  min="1"
                  max="50"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(e.target.value)}
                  required
                />
              </div>

              {/* Number of Answer Options */}
              <div className="space-y-2">
                <Label htmlFor="num-options">Number of Answer Options</Label>
                <Input
                  id="num-options"
                  type="number"
                  placeholder="Enter a number"
                  min="2"
                  max="20"
                  value={numOptions}
                  onChange={(e) => setNumOptions(e.target.value)}
                  required
                />
              </div>

              {/* Difficulty */}
              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger className="border-grey w-full" id="difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <Button type="submit" className="w-full">
            Generate
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
