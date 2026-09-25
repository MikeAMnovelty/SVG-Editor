import { S3Client, PutObjectCommand } from "https://cdn.skypack.dev/@aws-sdk/client-s3";

export const uploadSVGToS3 = async (file) => {
  // 1. Manually define your bucket info here
  const region = "us-east-2"; // Taken from your JSON 'auth' section
  const bucketName = "amnovelty-svg-uploads"; 

  const s3Client = new S3Client({
    region: region,
    credentials: {
      accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
      secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
    },
  });

  const params = {
    Bucket: bucketName,
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
