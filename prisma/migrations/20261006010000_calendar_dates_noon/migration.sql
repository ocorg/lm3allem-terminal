-- Calendar dates (a DAY chosen by the user, not an instant) are now stored at 12:00 UTC of that
-- day, so no time-zone difference between the server and a device can show the day before.
-- Old rows were stored at Morocco midnight (23:00 or 00:00 UTC): move them to noon of their day.
-- Idempotent: a value already at noon stays at noon.
UPDATE "Rental" SET
  "scheduledPickupDate" = date_trunc('day', "scheduledPickupDate" + interval '2 hours') + interval '12 hours',
  "scheduledReturnDate" = date_trunc('day', "scheduledReturnDate" + interval '2 hours') + interval '12 hours',
  "eventDate" = CASE WHEN "eventDate" IS NULL THEN NULL
                     ELSE date_trunc('day', "eventDate" + interval '2 hours') + interval '12 hours' END;
UPDATE "Expense" SET "date" = date_trunc('day', "date" + interval '2 hours') + interval '12 hours';
