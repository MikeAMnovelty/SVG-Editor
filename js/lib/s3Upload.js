import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "us-east-2",
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

export const uploadSVGToS3 = async (file) => {
  const params = {
    Bucket: "amnovelty-svg-uploads",
    Key: `uploads/${Date.now()}-${file.name}`,
    Body: file,
    ContentType: "image/svg+xml",
  };

  try {
    const response = await s3Client.send(new PutObjectCommand(params));
    console.log("S3 Upload Success!");
    return response;
  } catch (err) {
    console.error("S3 Upload Error:", err);
    throw err;
  }
};
