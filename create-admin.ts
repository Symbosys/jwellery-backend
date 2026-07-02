import prisma from './src/config/prisma.js';
import * as bcrypt from 'bcryptjs';

async function main() {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
  console.log('Found Admins:', admins.map((a: any) => a.email));

  if (admins.length === 0) {
    console.log('No admins found. Creating a default admin...');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const newAdmin = await prisma.user.create({
      data: {
        email: 'admin@vendor.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
      } as any
    });
    console.log('Created default admin: admin@vendor.com / admin123');
  } else {
    console.log('Resetting the first admin password to admin123 just in case...');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const firstAdmin = admins[0];
    if (firstAdmin) {
      await prisma.user.update({
        where: { id: firstAdmin.id },
        data: { password: hashedPassword }
      });
      console.log(`Reset password for ${firstAdmin.email} to admin123`);
    }
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
