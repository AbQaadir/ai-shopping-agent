-- AddColumn: phone, addresses, profileComplete to User model
ALTER TABLE "User" ADD COLUMN     "addresses" JSONB,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "profileComplete" BOOLEAN NOT NULL DEFAULT false;
