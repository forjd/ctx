export function loader(): Response {
  return new Response("accounts");
}

export default function AccountsRoute(): JSX.Element {
  return <h1>Accounts</h1>;
}
