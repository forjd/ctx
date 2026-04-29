import { requireAuth } from "../middleware/requireAuth";
import { getAccount } from "../handlers/getAccount";
import { accountSchema } from "../schemas/accountSchema";

export const accountRoutes = { requireAuth, getAccount, accountSchema };
