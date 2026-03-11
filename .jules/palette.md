## 2024-05-14 - Improve Keyboard Accessibility in Modals
**Learning:** Custom modal dialogs often lack standard keyboard interaction indicators, making them difficult for keyboard and screen reader users to navigate. Buttons without icons still benefit from clear `aria-label`s when their text might change dynamically (like 'Uploading...').
**Action:** Always add `focus-visible:ring-2` and `focus-visible:outline-none` to interactive elements in custom modals to match native browser focus indicators, and ensure form inputs have proper `id` to `htmlFor` bindings.
