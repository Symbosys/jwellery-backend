import prisma from "../../src/config/prisma.js";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Starting admin user seeding...");

  const adminEmail = process.env.ADMIN_SEED_EMAIL || "admin@symbosys.com";
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || "AdminPassword@123";
  const adminPhone = process.env.ADMIN_SEED_PHONE || "+919876543210";
  const adminFirstName = process.env.ADMIN_SEED_FIRST_NAME || "System";
  const adminLastName = process.env.ADMIN_SEED_LAST_NAME || "Admin";

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // Check if admin user already exists by email or phone
  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: adminEmail },
        { phoneNumber: adminPhone },
      ],
    },
  });

  if (existingAdmin) {
    console.log(`ℹ️ User found (ID: ${existingAdmin.id}). Updating to ADMIN role and resetting password...`);
    const updatedAdmin = await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        email: adminEmail,
        phoneNumber: adminPhone,
        password: hashedPassword,
        role: "ADMIN",
        firstName: existingAdmin.firstName || adminFirstName,
        lastName: existingAdmin.lastName || adminLastName,
      },
    });

    console.log("✅ Admin user updated successfully!");
    console.log(`📧 Email:    ${updatedAdmin.email}`);
    console.log(`🔑 Password: ${adminPassword}`);
    console.log(`👑 Role:     ${updatedAdmin.role}`);
  } else {
    console.log("🚀 Creating new admin user...");
    const newAdmin = await prisma.user.create({
      data: {
        email: adminEmail,
        phoneNumber: adminPhone,
        password: hashedPassword,
        role: "ADMIN",
        firstName: adminFirstName,
        lastName: adminLastName,
        gender: "MALE",
      },
    });

    console.log("✅ Admin user created successfully!");
    console.log(`📧 Email:    ${newAdmin.email}`);
    console.log(`🔑 Password: ${adminPassword}`);
    console.log(`👑 Role:     ${newAdmin.role}`);
  }

  console.log("✨ Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding admin user:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
