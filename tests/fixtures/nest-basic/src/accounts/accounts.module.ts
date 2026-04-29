import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";

export class AccountsModule {
  controllers = [AccountsController];
  providers = [AccountsService];
}
