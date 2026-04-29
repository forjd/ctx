import { AccountsService } from "./accounts.service";

export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}
}
