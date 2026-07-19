import dotenv from "dotenv";

dotenv.config();

const ENV = {
    PORT: process.env.PORT,
    JWT_SECRET: process.env.JWT_SECRET,
    FRONTEND_URL: process.env.FRONTEND_URL,
    FRONTEND_URL1: process.env.FRONTEND_URL1,

    EMAIL_USER: process.env.USER_EMAIL,
    EMAIL_APP_PASSWORD: process.env.EMAIL_APP_PASSWORD,


    // Cloudinary Credentials
    cloud_name: process.env.CLOUD_NAME, 
    cloud_api_key: process.env.CLOUD_API_KEY,  
    cloud_api_secret: process.env.CLOUD_API_SECRET,
    cloud_folder: process.env.CLOUD_FOLDER,

    mode: process.env.NODE_ENV,
    // AWS Credentials
    
    // Razorpay Credentials
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "",
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",

    // Cashfree Credentials
    CASHFREE_CLIENT_ID: process.env.CASHFREE_CLIENT_ID || "",
    CASHFREE_CLIENT_SECRET: process.env.CASHFREE_CLIENT_SECRET || "",
    CASHFREE_ENV: process.env.CASHFREE_ENV || "SANDBOX",
}

export default ENV;




