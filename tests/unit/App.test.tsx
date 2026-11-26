import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "../../src/app/App";

describe("placeholder app", () => {
  it("shows the version number and the feedback placeholder", () => {
    render(<App />);
    expect(screen.getAllByTestId("app-version")[0]).toHaveTextContent(/^Beta \d+\.\d+\.\d+/);
    expect(screen.getByTestId("feedback-placeholder")).toHaveTextContent(/placeholder/i);
  });
});
