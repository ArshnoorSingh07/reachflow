import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RichTextEditor } from "../../frontend/src/components/RichTextEditor";
import { Compose } from "../../frontend/src/components/Compose";
import { defaultConfig } from "../../frontend/src/config";
import { previewSenders } from "./fixtures";
it("formatting controls generate real rich HTML and plaintext", async () => {
  const user = userEvent.setup(),
    change = vi.fn();
  render(<RichTextEditor disabled={false} onChange={change} />);
  await user.click(screen.getByRole("button", { name: "Bold" }));
  await user.type(
    screen.getByRole("textbox", { name: "Message" }),
    "Formatted message",
  );
  await waitFor(() => expect(change).toHaveBeenCalled());
  expect(change.mock.lastCall?.[0]).toBe("Formatted message");
  expect(change.mock.lastCall?.[1]).toContain(
    "<strong>Formatted message</strong>",
  );
});
it("attachments can be uploaded, previewed and removed before scheduling", async () => {
  const user = userEvent.setup();
  render(
    <Compose
      senders={previewSenders}
      config={defaultConfig}
      close={vi.fn()}
      done={vi.fn()}
    />,
  );
  await user.upload(
    screen.getByLabelText("Attach files"),
    new File(["hello"], "notes.txt", { type: "text/plain" }),
  );
  expect(await screen.findByText("notes.txt")).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Remove attachment notes.txt" }),
  );
  expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();
});

it("cancelling send-later options leaves the existing schedule unchanged", async () => {
  const user = userEvent.setup();
  render(
    <Compose
      senders={previewSenders}
      config={defaultConfig}
      close={vi.fn()}
      done={vi.fn()}
    />,
  );
  const original = (screen.getByLabelText("Start sending") as HTMLInputElement)
    .value;
  await user.click(screen.getByRole("button", { name: "Choose send time" }));
  await user.click(screen.getByRole("button", { name: "Tomorrow, 3:00 PM" }));
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(
    (screen.getByLabelText("Start sending") as HTMLInputElement).value,
  ).toBe(original);
});
