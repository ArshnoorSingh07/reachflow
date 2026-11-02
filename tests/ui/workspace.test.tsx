import { defaultConfig } from "../../frontend/src/config";
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Compose } from "../../frontend/src/components/Compose";
import { EmailTable } from "../../frontend/src/components/EmailTable";
import { EmailDetail } from "../../frontend/src/components/EmailDetail";
import { previewEmails, previewSenders, previewStats } from "./fixtures";
function composer() {
  return render(
    <Compose
      config={defaultConfig}
      senders={previewSenders}
      close={vi.fn()}
      done={vi.fn()}
    />,
  );
}
describe("Compose workflow", () => {
  it("parses uploaded leads, removes duplicates, and displays the real recipient count", async () => {
    const user = userEvent.setup();
    composer();
    await user.upload(
      screen.getByLabelText("Upload lead file"),
      new File(
        [
          "email,name\nlead@example.com,Alex\nlead@example.com,Alex\nsecond@example.com,Jo",
        ],
        "leads.csv",
        { type: "text/csv" },
      ),
    );
    expect(await screen.findByText("2 unique recipients")).toBeInTheDocument();
    expect(screen.getByText(/1 duplicate removed/)).toBeInTheDocument();
    expect(screen.getByText("2 recipients")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove lead file" }));
    expect(screen.getByLabelText("Upload lead file")).toBeInTheDocument();
  });
  it("adds manual recipients, removes chips, and uses a chosen future send time", async () => {
    const user = userEvent.setup();
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    composer();
    await user.type(
      screen.getByLabelText("To"),
      "first@example.com{Enter}second@example.com{Enter}",
    );
    await user.click(
      screen.getByRole("button", { name: "Remove first@example.com" }),
    );
    expect(screen.getByText("1 recipients")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Choose send time" }));
    await user.click(
      screen.getByRole("button", { name: "Tomorrow, 10:00 AM" }),
    );
    const chosen = (
      screen.getByLabelText("Send later date and time") as HTMLInputElement
    ).value;
    await user.click(screen.getByRole("button", { name: "Done" }));
    await user.type(screen.getByLabelText("Subject"), "Scheduled hello");
    await user.type(screen.getByLabelText("Message"), "Hello there");
    await user.click(screen.getByRole("button", { name: "Schedule emails" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const data = JSON.parse(fetch.mock.calls[0][1]!.body as string);
    expect(data.recipients).toEqual(["second@example.com"]);
    expect(data.startAt).toEqual(new Date(chosen).toISOString());
  });
  it("uses server-provided limits instead of hardcoded bounds", () => {
    render(
      <Compose
        config={{ ...defaultConfig, minDelayMs: 5000, maxHourlyLimit: 50 }}
        senders={previewSenders}
        close={vi.fn()}
        done={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Delay between emails/)).toHaveAttribute(
      "min",
      "5",
    );
    expect(screen.getByLabelText(/Hourly limit/)).toHaveAttribute("max", "50");
  });
  it("does not schedule without valid recipients", async () => {
    const user = userEvent.setup();
    const fetch = vi.spyOn(globalThis, "fetch");
    composer();
    await user.type(screen.getByLabelText("Subject"), "Hello");
    await user.type(screen.getByLabelText("Message"), "A thoughtful hello");
    await user.click(screen.getByRole("button", { name: /Schedule emails/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "at least one valid email address",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("submits UTC scheduling values and preserves the idempotency key on retry", async () => {
    const user = userEvent.setup();
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Retry this request" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    );
    composer();
    await user.upload(
      screen.getByLabelText("Upload lead file"),
      new File(["lead@example.com"], "leads.txt", { type: "text/plain" }),
    );
    await user.type(screen.getByLabelText("Subject"), "Hello");
    await user.type(screen.getByLabelText("Message"), "A thoughtful hello");
    await user.click(screen.getByRole("button", { name: /Schedule emails/ }));
    await screen.findByText("Retry this request");
    await user.click(screen.getByRole("button", { name: /Schedule emails/ }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const first = fetch.mock.calls[0][1]!,
      second = fetch.mock.calls[1][1]!;
    expect(
      (first.headers as Record<string, string>)["idempotency-key"],
    ).toEqual((second.headers as Record<string, string>)["idempotency-key"]);
    const data = JSON.parse(first.body as string);
    expect(data.recipients).toEqual(["lead@example.com"]);
    expect(data.startAt).toMatch(/Z$/);
    expect(data.delayMs).toEqual(2000);
  });
});
describe("Email dashboard", () => {
  it("opens message details and sends filter changes to the workspace", async () => {
    const user = userEvent.setup(),
      select = vi.fn(),
      setStatus = vi.fn();
    render(
      <EmailTable
        view="scheduled"
        rows={previewEmails()}
        total={8}
        page={1}
        query=""
        sender=""
        status=""
        senders={previewSenders}
        loading={false}
        error=""
        setQuery={vi.fn()}
        setSender={vi.fn()}
        setStatus={setStatus}
        setPage={vi.fn()}
        refresh={vi.fn()}
        compose={vi.fn()}
        select={select}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "View email to olivia@northstar.co" }),
    );
    expect(select.mock.calls[0][0].recipient).toBe("olivia@northstar.co");
    await user.click(screen.getByRole("button", { name: "Filter emails" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter by status" }),
      "sending",
    );
    expect(setStatus).toHaveBeenCalledWith("sending");
  });
  it("provides an actionable empty state and does not show stale rows on error", () => {
    const props = {
      view: "scheduled" as const,
      rows: [],
      total: 0,
      page: 1,
      query: "",
      sender: "",
      status: "",
      senders: previewSenders,
      loading: false,
      error: "",
      setQuery: vi.fn(),
      setSender: vi.fn(),
      setStatus: vi.fn(),
      setPage: vi.fn(),
      refresh: vi.fn(),
      compose: vi.fn(),
      select: vi.fn(),
    };
    const { rerender } = render(<EmailTable {...props} />);
    expect(
      screen.getByRole("button", { name: "Compose an email" }),
    ).toBeInTheDocument();
    rerender(
      <EmailTable
        {...props}
        error="Search unavailable"
        rows={previewEmails()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Search unavailable");
    expect(screen.queryByText("olivia@northstar.co")).not.toBeInTheDocument();
  });
  it("shows message content, sender details and uncertain delivery guidance", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(previewEmails(true)[6]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    render(<EmailDetail email={previewEmails(true)[6]} close={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      await screen.findByText("Review before resending"),
    ).toBeInTheDocument();
    expect(screen.getByText(/I came across your team/)).toBeInTheDocument();
  });
});

describe("Required email list fields", () => {
  it("keeps scheduled statuses and sent timestamps in each message row", () => {
    const props = {
      view: "scheduled" as const,
      rows: previewEmails(),
      total: 8,
      page: 1,
      query: "",
      sender: "",
      status: "",
      senders: previewSenders,
      loading: false,
      error: "",
      setQuery: vi.fn(),
      setSender: vi.fn(),
      setStatus: vi.fn(),
      setPage: vi.fn(),
      refresh: vi.fn(),
      compose: vi.fn(),
      select: vi.fn(),
    };
    const { rerender } = render(<EmailTable {...props} />);
    const scheduled = screen.getByRole("button", {
      name: "View email to james@linearstudio.io",
    });
    expect(within(scheduled).getByText("Scheduled")).toBeInTheDocument();
    expect(scheduled).toHaveTextContent("Let’s build something great");
    const sent = previewEmails(true);
    rerender(<EmailTable {...props} view="sent" rows={sent} />);
    const delivered = screen.getByRole("button", {
      name: "View email to olivia@northstar.co",
    });
    expect(within(delivered).getByText("Sent")).toBeInTheDocument();
    expect(delivered.querySelector("time")).toHaveAttribute(
      "datetime",
      sent[0].sent_at,
    );
    const failed = screen.getByRole("button", {
      name: "View email to noah@craftwork.design",
    });
    expect(within(failed).getByText("Failed")).toBeInTheDocument();
    expect(within(failed).getByText("Not sent")).toBeInTheDocument();
  });
});
