import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

// Validation schema for MCQ
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

// Validation schema for Flashcards
const flashcardSchema = z.object({
  materialType: z.literal("flashcards"),
  topic: z.string().min(1, "Topic is required").max(200, "Topic too long"),
  numCards: z
    .number()
    .min(1, "Must be at least 1")
    .max(20, "Maximum 20 flashcards"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  cardType: z.enum(["definition", "concept", "example"]),
});

// Validation schema for Short Answer
const shortAnswerSchema = z.object({
  materialType: z.literal("shortAnswer"),
  topic: z.string().min(1, "Topic is required").max(200, "Topic too long"),
  numQuestions: z
    .number()
    .min(1, "Must be at least 1")
    .max(10, "Maximum 10 questions"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
});

const formSchema = z.discriminatedUnion("materialType", [mcqSchema, flashcardSchema, shortAnswerSchema]);

type FormData = z.infer<typeof formSchema>;

interface GenerateFormProps {
  onGenerate: (formData: FormData) => void;
}

export function GenerateForm({ onGenerate }: GenerateFormProps) {
  const [currentMaterialType, setCurrentMaterialType] = useState<"mcq" | "flashcards" | "shortAnswer">("mcq");

  const {
    control,
    handleSubmit,
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
    } as FormData,
  });

  const onSubmit = (data: FormData) => {
    console.log("Form submitted with materialType:", data.materialType);
    console.log("Current state materialType:", currentMaterialType);
    onGenerate(data);
  };

  // Handle material type change
  const handleMaterialTypeChange = (value: "mcq" | "flashcards" | "shortAnswer") => {
    console.log("=== Material Type Change ===");
    console.log("New value:", value);
    
    setCurrentMaterialType(value);
    
    if (value === "flashcards") {
      console.log("Resetting to flashcard defaults");
      reset({
        materialType: value,
        topic: "",
        numCards: 10,
        difficulty: "intermediate",
        cardType: "definition",
      } as FormData);
    } else if (value === "shortAnswer") {
      console.log("Resetting to short answer defaults");
      reset({
        materialType: value,
        topic: "",
        numQuestions: 3,
        difficulty: "intermediate",
      } as FormData);
    } else {
      console.log("Resetting to MCQ defaults");
      reset({
        materialType: value,
        topic: "",
        numQuestions: 5,
        numOptions: 4,
        difficulty: "intermediate",
      } as FormData);
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
                  value={currentMaterialType}
                  onValueChange={(value) => {
                    const newType = value as "mcq" | "flashcards" | "shortAnswer";
                    field.onChange(newType);
                    handleMaterialTypeChange(newType);
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
                    <SelectItem value="flashcards">
                      Flashcards
                    </SelectItem>
                    <SelectItem value="shortAnswer">
                      Short Answer
                    </SelectItem>
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
          {currentMaterialType === "mcq" && (
            <>
              {/* Number of Questions */}
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
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === "" ? "" : parseInt(value));
                      }}
                      className={(currentMaterialType === "mcq" && "numQuestions" in errors && errors.numQuestions) ? "border-red-500" : ""}
                    />
                  )}
                />
                {currentMaterialType === "mcq" && "numQuestions" in errors && errors.numQuestions && (
                  <p className="text-sm text-red-500">
                    {errors.numQuestions.message}
                  </p>
                )}
              </div>

              {/* Number of Answer Options */}
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
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === "" ? "" : parseInt(value));
                      }}
                      className={(currentMaterialType === "mcq" && "numOptions" in errors && errors.numOptions) ? "border-red-500" : ""}
                    />
                  )}
                />
                {currentMaterialType === "mcq" && "numOptions" in errors && errors.numOptions && (
                  <p className="text-sm text-red-500">
                    {errors.numOptions.message}
                  </p>
                )}
              </div>

              {/* Difficulty */}
              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty</Label>
                <Controller
                  name="difficulty"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        className="border-grey w-full"
                        id="difficulty"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">
                          Intermediate
                        </SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </>
          )}

          {/* Flashcard-specific Fields */}
          {currentMaterialType === "flashcards" && (
            <>
              {/* Number of Cards */}
              <div className="space-y-2">
                <Label htmlFor="num-cards">Number of Flashcards</Label>
                <Controller
                  name="numCards"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="num-cards"
                      type="number"
                      placeholder="Enter a number"
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === "" ? "" : parseInt(value));
                      }}
                      className={(currentMaterialType === "flashcards" && "numCards" in errors && errors.numCards) ? "border-red-500" : ""}
                    />
                  )}
                />
                {currentMaterialType === "flashcards" && "numCards" in errors && errors.numCards && (
                  <p className="text-sm text-red-500">
                    {errors.numCards.message}
                  </p>
                )}
              </div>

              {/* Card Type */}
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
                        <SelectItem value="example">Example</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* Difficulty */}
              <div className="space-y-2">
                <Label htmlFor="difficulty-fc">Difficulty</Label>
                <Controller
                  name="difficulty"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        className="border-grey w-full"
                        id="difficulty-fc"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">
                          Intermediate
                        </SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </>
          )}

          {/* Short Answer-specific Fields */}
          {currentMaterialType === "shortAnswer" && (
            <>
              {/* Number of Questions */}
              <div className="space-y-2">
                <Label htmlFor="num-questions-sa">Number of Questions</Label>
                <Controller
                  name="numQuestions"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="num-questions-sa"
                      type="number"
                      placeholder="Enter a number"
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === "" ? "" : parseInt(value));
                      }}
                      className={(currentMaterialType === "shortAnswer" && "numQuestions" in errors && errors.numQuestions) ? "border-red-500" : ""}
                    />
                  )}
                />
                {currentMaterialType === "shortAnswer" && "numQuestions" in errors && errors.numQuestions && (
                  <p className="text-sm text-red-500">
                    {errors.numQuestions.message}
                  </p>
                )}
              </div>

              {/* Difficulty */}
              <div className="space-y-2">
                <Label htmlFor="difficulty-sa">Difficulty</Label>
                <Controller
                  name="difficulty"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        className="border-grey w-full"
                        id="difficulty-sa"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">
                          Intermediate
                        </SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Generating..." : "Generate"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
