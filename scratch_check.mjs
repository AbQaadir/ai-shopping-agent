import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const session = await prisma.checkoutSession.findUnique({
      where: { chatSessionId: '07205755-7913-4814-b638-68a7a29e3e95' }
    });
    console.log('CheckoutSession:', JSON.stringify(session, null, 2));

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: '07205755-7913-4814-b638-68a7a29e3e95' },
      orderBy: { createdAt: 'asc' }
    });
    console.log('Messages count:', messages.length);
    console.log('Last message:', JSON.stringify(messages[messages.length - 1], null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
