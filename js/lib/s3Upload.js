import { S3Client, PutObjectCommand } from "https://cdn.skypack.dev/@aws-sdk/client-s3";
import outputs from "./amplify_outputs.json" with { type: "json" };

// We will fetch the config inside the function to avoid "Import Attribute" errors
//export const uploadSVGToS3 = async (file) => {
  //const responseConfig = await fetch('/amplify_outputs.json');
  //const outputs = await responseConfig.json();

  //const s3Client = new S3Client({
    //region: outputs.storage.aws_region,
    //credentials: {
      //accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
      //secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
    //},
  //});
  
  // ... rest of your existing code


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
