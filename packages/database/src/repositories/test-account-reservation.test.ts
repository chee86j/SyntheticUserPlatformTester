import assert from "node:assert/strict";
import test from "node:test";
import { canReserveAccount } from "./test-account-reservation.js";

test("non-concurrent account cannot be reserved if active reservation exists", () => {
  assert.equal(
    canReserveAccount({ allowConcurrentUse: false, activeReservationCount: 1, status: "RESERVED" }),
    false
  );
});

test("concurrent account can be reserved even with active reservations", () => {
  assert.equal(
    canReserveAccount({ allowConcurrentUse: true, activeReservationCount: 2, status: "RESERVED" }),
    true
  );
});

test("disabled account can never be reserved", () => {
  assert.equal(
    canReserveAccount({ allowConcurrentUse: true, activeReservationCount: 0, status: "DISABLED" }),
    false
  );
});
