import assert from "node:assert/strict";
import { test } from "node:test";

import { isAutomaticallyApprovedEmail } from "../src/lib/account-approval";

test("automatic approval requires a verified Google campus email", () => {
  assert.equal(
    isAutomaticallyApprovedEmail("student@zewail.edu.eg", "google", true),
    true,
  );
  assert.equal(
    isAutomaticallyApprovedEmail("student@zewail.edu.eg", "credentials", false),
    false,
  );
  assert.equal(
    isAutomaticallyApprovedEmail("student@zewail.edu.eg", "google", false),
    false,
  );
  assert.equal(
    isAutomaticallyApprovedEmail("student@zewailcity.edu.eg", "google", true),
    false,
  );
});
