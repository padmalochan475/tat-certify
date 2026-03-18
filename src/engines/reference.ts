import type { BranchRecord } from "../schema";

export interface NextReference {
  refNo: string;
  nextSerial: number;
  serialYear: number;
}

export function getNextRef(
  branch: BranchRecord,
  currentYear: number,
  refExists: (refNo: string) => boolean
): NextReference {
  let serialYear = branch.serial_year;
  let currentSerial = branch.current_serial;

  if (serialYear !== currentYear) {
    serialYear = currentYear;
    currentSerial = 0;
  }

  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    currentSerial += 1;
    const candidate = `TAT/${branch.code}/${currentSerial}/${currentYear}`;

    if (!refExists(candidate)) {
      return {
        refNo: candidate,
        nextSerial: currentSerial,
        serialYear
      };
    }
  }

  throw new Error(`Unable to generate a unique reference number for branch ${branch.code}`);
}
