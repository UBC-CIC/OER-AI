import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { AuthService } from "@/functions/authService";

interface FileUploaderProps {
  onUploadComplete?: (key: string, bucket: string) => void;
  allowedTypes?: string[];
  maxSizeMB?: number;
}

export default function FileUploader({
  onUploadComplete,
  allowedTypes = ["*"],
  maxSizeMB = 10,
}: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStatus({ type: null, message: "" });
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];

      // Validate file size
      if (selectedFile.size > maxSizeMB * 1024 * 1024) {
        setStatus({
          type: "error",
          message: `File size must be less than ${maxSizeMB}MB`,
        });
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setStatus({ type: null, message: "" });

      // 1. Get pre-signed URL
      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      const presignedResponse = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }/generate-presigned-url?file_name=${encodeURIComponent(
          file.name
        )}&content_type=${encodeURIComponent(file.type)}`,
        {
          headers: {
            Authorization: token,
          },
        }
      );

      if (!presignedResponse.ok) {
        throw new Error("Failed to generate upload URL");
      }

      const { presignedUrl, key, bucket } = await presignedResponse.json();

      // 2. Upload file to S3
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to S3");
      }

      // Success
      setStatus({
        type: "success",
        message: `File ${file.name} uploaded successfully.`,
      });

      setFile(null);
      if (onUploadComplete) {
        onUploadComplete(key, bucket);
      }
    } catch (error) {
      console.error("Upload error:", error);
      setStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg bg-white shadow-sm">
      <div className="flex items-center gap-4">
        <Input
          type="file"
          onChange={handleFileChange}
          disabled={uploading}
          className="flex-1"
          accept={allowedTypes.join(",")}
        />
        <Button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="min-w-[120px]"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </>
          )}
        </Button>
      </div>

      {file && !status.message && (
        <p className="text-sm text-gray-500">
          Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
        </p>
      )}

      {status.message && (
        <div
          className={`flex items-center gap-2 text-sm p-3 rounded-md ${
            status.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {status.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {status.message}
        </div>
      )}
    </div>
  );
}
