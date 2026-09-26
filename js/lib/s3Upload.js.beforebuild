export const uploadSVGToS3 = async (file) => {
  // 1. THE FIX: Create a fake 'process' object so the AWS SDK doesn't crash
  if (typeof window !== 'undefined' && !window.process) {
    window.process = { env: {}, version: '' };
  }

  // 2. THE FIX: Use a more stable CDN (jsdelivr) and load it dynamically
  // so the 'process' fix above runs FIRST.
  const { S3Client, PutObjectCommand } = await import("https://cdn.jsdelivr.net/npm/@aws-sdk/client-s3/+esm");

  const region = "us-east-2"; 
  const bucketName = "amnovelty-svg-uploads"; 

  // These will be replaced by your 'sed' command in amplify.yml
  const accessKeyId = import.meta.env.VITE_AWS_ACCESS_KEY_ID;
  const secretAccessKey = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY;

  // Safety check to ensure the 'sed' command worked
  if (!accessKeyId || typeof accessKeyId !== 'string' || accessKeyId.includes("import.meta")) {
    throw new Error("AWS Credentials not found. Please check your Amplify build logs.");
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
