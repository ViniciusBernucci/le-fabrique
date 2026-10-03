import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DeliveryPanel } from "./DeliveryPanel";

it("does not approve or load delivery until the operator requests a review", () => {
  const html = renderToStaticMarkup(
    <DeliveryPanel token="synthetic-session" runId={crypto.randomUUID()} version={3} />,
  );
  expect(html).toContain("Revisar entrega e documentação");
  expect(html).not.toContain("Aceitar esta entrega");
  expect(html).not.toContain("synthetic-session");
});
