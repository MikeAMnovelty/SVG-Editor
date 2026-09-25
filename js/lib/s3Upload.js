// We are switching to esm.sh which handles the AWS SDK much better for browsers
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3";

export const uploadSVGToS3 = async (file) => {
  const region = "us-east-2"; 
  const bucketName = "amnovelty-svg-uploads"; 

  // These will be replaced by your 'sed' command in amplify.yml
  const accessKeyId = import.meta.env.VITE_AWS_ACCESS_KEY_ID;
  const secretAccessKey = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY;

  // Safety check: If the sed command failed, this will stop the crash
  if (!accessKeyId || accessKeyId.includes("import.meta")) {
    console.error("AWS Keys not found. Check Amplify build logs.");
    throw new Error("Credentials not injected");
  }

  const s3Client = new S3Client({
    region: region,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
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
