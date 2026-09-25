import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import outputs from "../../amplify_outputs.json";

// This uses the configuration Amplify already generated for you
const s3Client = new S3Client({
  region: outputs.storage.aws_region,
  // We will handle credentials in the next step to keep them off GitHub
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

export const uploadSVGToS3 = async (file) => {
  const params = {
    Bucket: outputs.storage.bucket_name,
    Key: `uploads/${Date.now()}-${file.name}`,
    Body: file,
    ContentType: "image/svg+xml",
  };

  try {
    const response = await s3Client.send(new PutObjectCommand(params));
    console.log("Upload success:", response);
    return response;
  } catch (err) {
    console.error("S3 Upload Error:", err);
    throw err;
  }
};
