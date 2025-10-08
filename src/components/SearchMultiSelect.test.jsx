import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchMultiSelect from "./SearchMultiSelect.jsx";

describe("SearchMultiSelect", () => {
  it("allows selecting suggestions and removing tokens", async () => {
    const user = userEvent.setup();

    const Wrapper = () => {
      const [value, setValue] = React.useState([]);
      return (
        <SearchMultiSelect
          suggestions={["Dubai", "Abu Dhabi", "Sharjah"]}
          value={value}
          onChange={setValue}
          placeholder="Search"
          name="test-search"
        />
      );
    };

    render(<Wrapper />);

    const input = screen.getByRole("combobox", { name: /search listings/i });
    await user.click(input);
    await user.type(input, "Du");

    const option = await screen.findByRole("option", { name: "Dubai" });
    await user.click(option);

    expect(screen.getByText("Dubai")).toBeInTheDocument();

    const removeButton = screen.getByRole("button", { name: /remove dubai/i });
    await user.click(removeButton);

    expect(screen.queryByText("Dubai")).not.toBeInTheDocument();
  });

  it("adds custom tokens when pressing enter", async () => {
    const user = userEvent.setup();

    const handleChange = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = React.useState([]);
      const handleValueChange = (tokens) => {
        setValue(tokens);
        handleChange(tokens);
      };
      return (
        <SearchMultiSelect
          suggestions={["Coupe"]}
          value={value}
          onChange={handleValueChange}
          placeholder="Search"
          name="custom-search"
        />
      );
    };

    render(<Wrapper />);

    const input = screen.getByRole("combobox", { name: /search listings/i });
    await user.type(input, "Electric{enter}");

    expect(await screen.findByText("Electric")).toBeInTheDocument();
    expect(handleChange).toHaveBeenCalledWith(["Electric"]);

    // Entering the same value again should not duplicate it
    await user.type(input, "Electric{enter}");
    expect(handleChange).toHaveBeenLastCalledWith(["Electric"]);
  });
});
