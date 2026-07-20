import app from "../src/index.ts";

const server = app.listen(4005, async () => {
  console.log("Test server running on port 4005");

  const originsToTest = [
    { origin: "http://localhost:3000", expectedAllowed: true },
    { origin: "https://jwellery-frontend-seven.vercel.app", expectedAllowed: true },
    { origin: "https://jwellery-admin-delta.vercel.app", expectedAllowed: true },
    { origin: "https://some-preview-123.vercel.app", expectedAllowed: true },
    { origin: "https://google.com", expectedAllowed: false },
  ];

  try {
    for (const test of originsToTest) {
      const response = await fetch("http://localhost:4005/", {
        method: "OPTIONS",
        headers: {
          "Origin": test.origin,
          "Access-Control-Request-Method": "GET",
        },
      });

      const allowedOriginHeader = response.headers.get("access-control-allow-origin");
      const status = response.status;

      console.log(`\nTesting Origin: ${test.origin}`);
      console.log(`Response Status: ${status}`);
      console.log(`Access-Control-Allow-Origin: ${allowedOriginHeader}`);

      if (test.expectedAllowed) {
        if (allowedOriginHeader === test.origin) {
          console.log("✅ ALLOWED (Passed)");
        } else {
          console.log(`❌ Expected allowed, but got: ${allowedOriginHeader}`);
        }
      } else {
        if (!allowedOriginHeader) {
          console.log("✅ BLOCKED (Passed - no CORS headers returned)");
        } else {
          console.log(`❌ Expected blocked, but allowed: ${allowedOriginHeader}`);
        }
      }

      // Check if there was any server crash (status 500)
      if (status === 500) {
        console.log("❌ Server returned 500 Internal Server Error!");
      }
    }
  } catch (error) {
    console.error("Test execution failed:", error);
  } finally {
    server.close(() => {
      console.log("\nTest server closed.");
      process.exit(0);
    });
  }
});
