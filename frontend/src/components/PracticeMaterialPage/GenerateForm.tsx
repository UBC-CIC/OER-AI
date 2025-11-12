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

// Validation schema
const formSchema = z.object({
  materialType: z.literal("mcq"),
  topic: z.string().min(1, "Topic is required").max(200, "Topic too long"),
  numQuestions: z
    .number()
    .min(1, "Must be at least 1")
    .max(20, "Maximum 20 questions"),
  numOptions: z
    .number()
    .min(2, "Must be at least 2")
    .max(8, "Maximum 8 options"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
});

type FormData = z.infer<typeof formSchema>;

interface GenerateFormProps {
  onGenerate: (formData: FormData) => void;
}

export function GenerateForm({ onGenerate }: GenerateFormProps) {
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      materialType: "mcq",
      topic: "",
      numQuestions: 5,
      numOptions: 4,
      difficulty: "intermediate",
    },
  });

  // watch current material type
  const materialType = watch("materialType");

  const onSubmit = (data: FormData) => {
    onGenerate(data);
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
                <Select value={field.value} onValueChange={field.onChange}>
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
          {materialType === "mcq" && (
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
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 0)
                      }
                      className={errors.numQuestions ? "border-red-500" : ""}
                    />
                  )}
                />
                {errors.numQuestions && (
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
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 0)
                      }
                      className={errors.numOptions ? "border-red-500" : ""}
                    />
                  )}
                />
                {errors.numOptions && (
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

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Generating..." : "Generate"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
