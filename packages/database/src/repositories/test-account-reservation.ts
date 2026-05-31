export type ReservationCheckInput = {
  allowConcurrentUse: boolean;
  activeReservationCount: number;
  status: "AVAILABLE" | "RESERVED" | "DISABLED";
};

export function canReserveAccount(input: ReservationCheckInput): boolean {
  if (input.status === "DISABLED") {
    return false;
  }

  if (input.allowConcurrentUse) {
    return true;
  }

  return input.activeReservationCount === 0;
}
