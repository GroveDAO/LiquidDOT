import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { syncOperatorState } from "../lib/operator";

task("operator:sync", "Sweep, stake, fund withdrawals, and sync nominees for LiquidDOT")
  .addOptionalParam("maxsweep", "Optional max PAS amount to sweep from the vault (10-decimal planck units)")
  .setAction(
    async (
      taskArgs: { maxsweep?: string },
      hre: HardhatRuntimeEnvironment
    ) => {
      const result = await syncOperatorState(hre, {
        maxSweep: taskArgs.maxsweep ? BigInt(taskArgs.maxsweep) : undefined,
        log: (message) => console.log(message),
      });

      console.log(
        JSON.stringify(
          {
            sweptAmount: result.sweptAmount.toString(),
            bondedAmount: result.bondedAmount.toString(),
            unbondedAmount: result.unbondedAmount.toString(),
            fundedRequestIds: result.fundedRequestIds.map((value) => value.toString()),
            nominatedNominees: result.nominatedNominees,
            transactions: result.transactions,
          },
          null,
          2
        )
      );
    }
  );
