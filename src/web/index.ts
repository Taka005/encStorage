import { Client } from "./Client";

const client = new Client();

const passwordInput = prompt("Enter password:");

if (passwordInput) {
  client.setPassword(passwordInput);
}