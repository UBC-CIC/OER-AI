import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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

// Validation schema (match GenerateForm behaviour)
const mcqSchema = z.object({
  materialType: z.literal("mcq"),
  topic: z.string().min(1, "Topic is required").max(200, "Topic too long"),
  numQuestions: z
    .number()
    .min(1, "Must be at least 1")
    .max(8, "Maximum 8 questions"),
  numOptions: z
    .number()
    .min(2, "Must be at least 2")
    .max(8, "Maximum 8 options"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
});

const flashcardSchema = z.object({
  materialType: z.literal("flashcards"),
  topic: z.string().min(1, "Topic is required").max(200, "Topic too long"),
  numCards: z.number().min(1, "Must be at least 1").max(30, "Maximum 30 cards"),
  cardType: z.enum(["definition", "concept", "formula", "general"]),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
});

const shortAnswerSchema = z.object({
  materialType: z.literal("shortAnswer"),
  topic: z.string().min(1, "Topic is required").max(200, "Topic too long"),
  numQuestions: z
    .number()
    .min(1, "Must be at least 1")
    .max(10, "Maximum 10 questions"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
});

const formSchema = z.discriminatedUnion("materialType", [
  mcqSchema,
  flashcardSchema,
  shortAnswerSchema,
]);

type FormData = z.infer<typeof formSchema>;

interface MaterialEditorFormProps {
  onGenerate: (formData: FormData) => void;
}

export function MaterialEditorForm({ onGenerate }: MaterialEditorFormProps) {
  // const [currentMaterialType, setCurrentMaterialType] = useState<
  const [, setCurrentMaterialType] = useState<
    "mcq" | "flashcards" | "shortAnswer"
  >("mcq");

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      materialType: "mcq",
      topic: "",
      numQuestions: 5,
      numOptions: 4,
      difficulty: "intermediate",
    } as any,
  });

  const materialType = watch("materialType");

  const onSubmit = (data: FormData) => {
    onGenerate(data);
  };

  // Handle material type change
  const handleMaterialTypeChange = (
    value: "mcq" | "flashcards" | "shortAnswer"
  ) => {
    setCurrentMaterialType(value);

    if (value === "flashcards") {
      reset({
        materialType: value,
        topic: "",
        numCards: 10,
        difficulty: "intermediate",
        cardType: "general",
      } as any);
    } else if (value === "shortAnswer") {
      reset({
        materialType: value,
        topic: "",
        numQuestions: 5,
        difficulty: "intermediate",
      } as any);
    } else {
      reset({
        materialType: value,
        topic: "",
        numQuestions: 5,
        numOptions: 4,
        difficulty: "intermediate",
      } as any);
    }
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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(onSubmit)();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="material-type">Material Type</Label>
            <Controller
              name="materialType"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    handleMaterialTypeChange(
                      value as "mcq" | "flashcards" | "shortAnswer"
                    );
                  }}
                >
                  <SelectTrigger
                    className="border-grey w-full"
                    id="material-type"
                  >
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">
                      Multiple Choice Questions
                    </SelectItem>
                    <SelectItem value="flashcards">Flashcards</SelectItem>
                    <SelectItem value="shortAnswer">Short Answer</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Topic */}
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <Controller
              name="topic"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  id="topic"
                  placeholder="Describe a topic"
                  className={errors.topic ? "border-red-500" : ""}
                />
              )}
            />
            {errors.topic && (
              <p className="text-sm text-red-500">{errors.topic.message}</p>
            )}
          </div>

          {/* Conditional Fields based on Material Type */}
          {(materialType === "mcq" || materialType === "shortAnswer") && (
            <div className="space-y-2">
              <Label htmlFor="num-questions">Number of Questions</Label>
              <Controller
                name="numQuestions"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="num-questions"
                    type="number"
                    placeholder="Enter a number"
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value) || 0)
                    }
                    className={
                      (errors as any).numQuestions ? "border-red-500" : ""
                    }
                  />
                )}
              />
              {(errors as any).numQuestions && (
                <p className="text-sm text-red-500">
                  {(errors as any).numQuestions.message}
                </p>
              )}
            </div>
          )}

          {materialType === "flashcards" && (
            <div className="space-y-2">
              <Label htmlFor="num-cards">Number of Cards</Label>
              <Controller
                name="numCards"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="num-cards"
                    type="number"
                    placeholder="Enter a number"
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value) || 0)
                    }
                    className={(errors as any).numCards ? "border-red-500" : ""}
                  />
                )}
              />
              {(errors as any).numCards && (
                <p className="text-sm text-red-500">
                  {(errors as any).numCards.message}
                </p>
              )}
            </div>
          )}

          {materialType === "mcq" && (
            <div className="space-y-2">
              <Label htmlFor="num-options">Number of Answer Options</Label>
              <Controller
                name="numOptions"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="num-options"
                    type="number"
                    placeholder="Enter a number"
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value) || 0)
                    }
                    className={
                      (errors as any).numOptions ? "border-red-500" : ""
                    }
                  />
                )}
              />
              {(errors as any).numOptions && (
                <p className="text-sm text-red-500">
                  {(errors as any).numOptions.message}
                </p>
              )}
            </div>
          )}

          {materialType === "flashcards" && (
            <div className="space-y-2">
              <Label htmlFor="card-type">Card Type</Label>
              <Controller
                name="cardType"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      className="border-grey w-full"
                      id="card-type"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="definition">Definition</SelectItem>
                      <SelectItem value="concept">Concept</SelectItem>
                      <SelectItem value="formula">Formula</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          {/* Difficulty */}
          <div className="space-y-2">
            <Label htmlFor="difficulty">Difficulty</Label>
            <Controller
              name="difficulty"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="border-grey w-full" id="difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <Button
            type="submit"
            className="cursor-pointer w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Generating..." : "Generate"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
