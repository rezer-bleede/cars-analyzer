import React, { useEffect, useMemo, useRef, useState } from "react";

const toLower = (value) => (typeof value === "string" ? value.toLowerCase() : "");

const MAX_SUGGESTIONS = 8;

const SearchMultiSelect = ({
  suggestions = [],
  value = [],
  onChange,
  placeholder = "Search…",
  name = "search",
  id,
  ariaLabel = "Search listings",
}) => {
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const normalizedSelected = useMemo(
    () => new Set(value.map((token) => toLower(token))),
    [value]
  );

  const availableSuggestions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const filtered = suggestions.filter((suggestion) => {
      if (!suggestion) return false;
      if (normalizedSelected.has(suggestion.toLowerCase())) return false;
      if (!trimmed) return true;
      return suggestion.toLowerCase().includes(trimmed);
    });
    return filtered.slice(0, MAX_SUGGESTIONS);
  }, [suggestions, normalizedSelected, query]);

  const commitTokens = (tokens) => {
    if (!onChange) return;
    const next = Array.from(new Set(tokens.map((token) => token.trim()).filter(Boolean)));
    onChange(next);
  };

  const addToken = (token) => {
    if (!token) return;
    const trimmed = token.trim();
    if (!trimmed) return;
    if (normalizedSelected.has(trimmed.toLowerCase())) {
      setQuery("");
      return;
    }
    commitTokens([...value, trimmed]);
    setQuery("");
    setHighlightedIndex(0);
    setIsOpen(false);
  };

  const removeToken = (token) => {
    commitTokens(value.filter((item) => item !== token));
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(0);
    } else {
      setHighlightedIndex((current) => {
        if (availableSuggestions.length === 0) return 0;
        return Math.min(current, availableSuggestions.length - 1);
      });
    }
  }, [isOpen, availableSuggestions]);

  const handleInputKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (isOpen && availableSuggestions[highlightedIndex]) {
        addToken(availableSuggestions[highlightedIndex]);
      } else if (query.trim()) {
        addToken(query.trim());
      }
    } else if (event.key === "Backspace" && !query) {
      if (value.length) {
        event.preventDefault();
        removeToken(value[value.length - 1]);
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setHighlightedIndex((index) => {
        if (!availableSuggestions.length) return 0;
        return (index + 1) % availableSuggestions.length;
      });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setHighlightedIndex((index) => {
        if (!availableSuggestions.length) return 0;
        return (index - 1 + availableSuggestions.length) % availableSuggestions.length;
      });
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  const inputId = id || name;
  const listboxId = `${inputId}-suggestions`;

  return (
    <div className="search-multiselect" ref={containerRef}>
      <div
        className="search-multiselect__input"
        onClick={() => {
          inputRef.current?.focus();
          setIsOpen(true);
        }}
      >
        <div className="search-multiselect__chips">
          {value.map((token) => (
            <span className="search-multiselect__chip" key={token}>
              <span className="search-multiselect__chip-label">{token}</span>
              <button
                type="button"
                className="search-multiselect__chip-remove"
                onClick={(event) => {
                  event.stopPropagation();
                  removeToken(token);
                }}
                aria-label={`Remove ${token}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            name={name}
            id={inputId}
            value={query}
            placeholder={value.length ? "Add another…" : placeholder}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onKeyDown={handleInputKeyDown}
            onFocus={() => setIsOpen(true)}
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-label={ariaLabel}
            role="combobox"
          />
        </div>
      </div>

      {isOpen && availableSuggestions.length > 0 ? (
        <ul className="search-multiselect__list" role="listbox" id={listboxId}>
          {availableSuggestions.map((suggestion, index) => {
            const isActive = index === highlightedIndex;
            return (
              <li key={suggestion}>
                <button
                  type="button"
                  className={`search-multiselect__option${isActive ? " is-active" : ""}`}
                  role="option"
                  aria-selected={isActive}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addToken(suggestion)}
                >
                  {suggestion}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};

export default SearchMultiSelect;
