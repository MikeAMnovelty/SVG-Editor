import { S3Client, PutObjectCommand } from "https://cdn.skypack.dev/@aws-sdk/client-s3";

export const uploadSVGToS3 = async (file) => {
  // 1. Fetch the configuration
  const responseConfig = await fetch('/amplify_outputs.json');
  const outputs = await responseConfig.json();

  // 2. Initialize the S3 Client inside the function
  const s3Client = new S3Client({
    region: outputs.storage.aws_region,
    credentials: {
      accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
      secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
    },
  });

  // 3. Set up the upload parameters
  const params = {
    Bucket: outputs.storage.bucket_name,
    Key: `uploads/${Date.now()}-${file.name}`,
    Body: file,
    ContentType: "image/svg+xml",
  };

  // 4. Execute the upload
  try {
    const response = await s3Client.send(new PutObjectCommand(params));
    console.log("Upload success:", response);
    return response;
  } catch (err) {
    console.error("S3 Upload Error:", err);
    throw err;
  }
};
