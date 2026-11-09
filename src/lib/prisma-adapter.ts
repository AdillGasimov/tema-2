import { PrismaPg } from "@prisma/adapter-pg";
import { manageDatabasePool } from "./database-pool";

export class ServerlessPrismaPg extends PrismaPg {
  override async connect() {
    const adapter = await super.connect();
    manageDatabasePool(adapter.underlyingDriver());
    return adapter;
  }
}
