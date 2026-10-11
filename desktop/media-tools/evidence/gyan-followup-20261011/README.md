# Gyan second reply — source review, 11 October 2026

**Gyan RESPONDED — user-provided email text; yt-dlp AWAITING RESPONSE. FFmpeg and yt-dlp source gates remain BLOCKED / INCOMPLETE.** Same FFmpeg/FFprobe 9.0.2 and yt-dlp 2026.08.19 binaries; docs/evidence only. Portable taskbar PASS and other existing gates are preserved.

## Reply provenance

The user supplied this reply on **2026-10-11 / Asia/Bangkok**, twice. [One complete transcription](gyan-reply-text.txt) retained: **1768 bytes**, SHA256 **`fe521dcb2e3da76b1923a959fbd9ed65620dd09950916ffc6360cf79680ac5b4`**. Ordinary whitespace is normalized; Markdown transport backslashes/link markup remain. This is user-provided text, not .eml or independently authenticated email. No original sender/header/Message-ID or reply timestamp was provided. **2026-10-10 09:31 pm** is the quoted **Yod request**, with unspecified timezone, not Gyan's reply time. [Provenance and task-instruction receipt](reply-provenance.json).

The follow-up is **RESPONDED** based on that quoted request/reply, without independent sending proof or a claim that the sent body matched our draft. No agent email/issue was sent. Preserve [first reply/audit](../gyan-response-20261010/README.md), [historic draft body](../gyan-response-20261010/GYAN-FOLLOWUP-DRAFT.md) and [request history/tracking](../source-requests-20261009/README-พี่ยอด.md).

## Publisher confirmations

| Input | Confirmed through supplied text | Remaining limits |
| --- | --- | --- |
| libxml2 | [GNOME/libxml2](https://github.com/GNOME/libxml2.git), `31094e5d0f65a528965e8c32a488e5a7f36118ca`; vanilla CMake, nothing custom | Selected iconv/ICU/zlib/thread/static/shared flags and modifications not itemized |
| zlib-ng | [zlib-ng/zlib-ng](https://github.com/zlib-ng/zlib-ng.git), `9174ab6bf58ac9a518dbe197b948c897f74834f5`; compatibility ON; all downstream use this lib | Publisher assertion in this Gyan FFmpeg context, not independent binary verification or a statement about yt-dlp/whole app; other selections/modifications unresolved |
| bzip2 1.0.8-4, GnuTLS 3.8.13-3, libiconv 1.19-1, GMP 6.3.0 | MSYS2 package origin | Exact recipe commit, architecture and patch selection not expressly identified; GMP pkgrel not given |
| fontconfig 2.18.3 / XZ 5.8.4 | No new provenance confirmation; first-reply versions retained | Candidate MSYS2 recipes remain candidates |

Gyan's view that these artifacts should not be needed for license compliance is recorded as his statement. He says most ephemeral artifacts were not archived and may start recording with 9.1; this is not a completeness finding or a promise. No 9.1 upgrade/new build occurs.

## Retained source/recipe review

Eight archives and seven upstream full Git commits from the first audit are retained; the two snapshot repo/commit identities now additionally have publisher confirmation. No new source archive/binary fetched, no GMP Hg revision invented. [Updated eight-input review](confirmed-source-review.json), [old fetch receipts](../gyan-response-20261010/upstream-receipts.json), [selected source-text receipts](../gyan-response-20261010/source-text-receipts.json).

| Matching candidate recipe | Retained full recipe commit | Coverage |
| --- | --- | --- |
| bzip2 1.0.8-4 | `4660b7d07063b222cfe8f7c20d465e6948f1ba41` | Release SHA matches; three patches, prepare/build/install commands |
| GnuTLS 3.8.13-3 | `7d02a6f9d520f8df4b346a1144765c499d115c48` | Release SHA matches; four patches, static/shared branches/install; static disables p11-kit and libdane |
| libiconv 1.19-1 | `045d46aedb9fdbd93b0900b1e20c1a6c73f23072` | Release SHA matches; three patches, generated-table regeneration/build/install; libcharset inside source |
| GMP 6.3.0-2 (pkgrel candidate) | `c9e5b84b9bd7ac93517ffc177522606b9762c1e5` | Release SHA matches; two patches, autoreconf with preserved config.guess/sub, static/shared build/install |

Exact selected recipe commits remain C. The existing **14 candidate patch checks** are retained: 13 Git apply passes; bzip2 progress patch passed GNU patch with offsets/fuzz 2 after Git apply failed. Applicability is not publisher patch-use proof or build success. Unchanged checks were not rerun. [Patch results](../gyan-response-20261010/patch-checks.json). Current libxml2 2.15.4-1 and zlib-ng 2.3.3-2 MSYS2 recipes are comparison only; do not assign their patches to the confirmed Git snapshots.

Exact libxml2 [README](../gyan-response-20261010/source-text/libxml2/README.md) gives CMake configure/build/install/static options; [CMake controls](../gyan-response-20261010/source-text/libxml2/CMakeLists.txt) generate configuration/header/pkg-config files. Defaults are shared ON, iconv ON, ICU OFF, threads ON, zlib OFF when legacy OFF; zlib is legacy-dependent. These defaults do not prove actual settings. “Vanilla CMake” confirms the route, not every flag or absence of source patches. Exact zlib-ng [README](../gyan-response-20261010/source-text/zlib-ng/README.md)/[CMake](../gyan-response-20261010/source-text/zlib-ng/CMakeLists.txt) provide build/install controls; source defaults compat OFF, overridden by confirmed ON. GoogleTest/benchmarks are test options, not runtime inclusion proof.

Upstream controls and matching package recipes give partial coverage. They do not supply the necessary portions of the custom pipeline for the combined FFmpeg input set. Assess which original controls/configuration are necessary; do not demand unrelated machine automation or every transient log. Buildability does not require bit-identical output.

GMP's matching recipe uses checksummed **release tarball** `a3c2b80201b89e68616f4ad30bc66aee4927c3ce50e33929ca819d5c43538898`, not a Hg checkout. Historical Hg HTTP 403 remains recorded but **is retired as a standalone blocker** for this route; exact GMP pkgrel remains C. Reopen source identity if evidence points to a different input.

Potential dependency branches remain questions: fontconfig → Expat/FreeType/selected intl/iconv/threads; GnuTLS → nettle/hogweed/GMP, tasn1, idn2/unistring and selected compression/intl/threads; libxml2 optional iconv/ICU/zlib/threads; XZ library versus tool gettext scope. Package dependencies are not a verified link graph; MSYS2 confirmation is not extended to these transitives or fontconfig/XZ.

## Remaining A/B/C gaps

We read [GPLv3 §1](https://www.gnu.org/licenses/gpl-3.0.html#section1) and the [GNU exact-hash FAQ](https://www.gnu.org/licenses/gpl-faq.en.html#MustSourceBuildToMatchExactHashOfBinary). Actual preferred source and necessary build/install/run/modify controls are required within scope, with System Library, unmodified available-tool and regenerable-material exclusions. A rebuilt binary need not match the distributed binary's exact hash. This is our application of official criteria to evidence. [Raw legal snapshots/receipts](legal-receipts.json).

| Class | Specific remaining gap |
| --- | --- |
| A — necessary source/build controls | FFmpeg source of **35 of 37 README external rows** still uncollected (rubberband/vid.stab collected), applicable included modifications/transitive source and necessary custom build/install controls. yt-dlp native preferred source/controls and JS preferred-source coverage incomplete |
| B — additional audit/reproducibility | Ephemeral logs/link maps/compiler/runner snapshots helpful, not automatic requirements. Indispensable non-regenerable config/control inside an artifact is A. Exact rebuilt hash not required; GMP Hg metadata alone no longer blocks release-source route |
| C — unresolved selection/scope | Actual patches/config/transitive inclusion, original MSYS2 recipe/architecture/GMP pkgrel, yt-dlp native/JS mapping and runtime/System Library scope. Resolve before requiring corresponding inputs. No-patch attestation or a particular link map is an evidence option, not the only prescribed proof |

[All 84 row reassessments](source-gap-assessment.json) preserve previous missing items and identify current issue IDs. [Inventory](../source-taskbar-20261009/SOURCE-INVENTORY.md) retains **84 rows / 42 source/build-input files**. Missing every log is not automatic failure; publisher opinion alone does not close the gate. **FFmpeg BLOCKED / INCOMPLETE** for source/control coverage and unresolved selection; **yt-dlp BLOCKED / INCOMPLETE, AWAITING RESPONSE** for separate native/JS/control/scope gaps. [Closure plan](../source-taskbar-20261009/SOURCE-CLOSURE-PLAN.md).

## Validation and private backup

Baseline `db1be04fdfa7cb663338156b1f839e7d8f9bcfae`, branch `codex/source-taskbar-review-20261009`, clean tree, private-backup upstream. [Baseline](baseline.json). [Validation](validation.json) checks JSON/paths/receipts, source/patch hashes, preserved draft bodies/history, inventory counts, archived r2, original binaries/package and docs-only scope. No app/playback/rebuild tests repeated.

[User task instructions](user-task-instructions.txt) authorize docs/evidence commit and current-branch push to verified **private-backup only**. [Filtered live repository metadata](private-destination-check.json) records `private: true`, identity and fetch/push URL; credentials are not printed/saved. Public origin is excluded; no force push/merge/release/deploy. Actual commit/private push result is reported after comparing HEADs. The post-push receipt at `archives/private-push-verification.json` is written after success and kept ignored to avoid self-referential commit metadata.

Local source archives remain ignored and **are not uploaded by this docs commit**. Receipts/selected text/docs are backed up, not a complete source-delivery bundle. Archived r2 and binaries/dependencies/vendor/version/runtime/shortcuts remain unchanged. `apply-review.py` reconstructs this dated working-inventory update from baseline; historical generators must not overwrite the current review. `collect-legal.py` fetches official references; `validate-review.py` checks this docs-only change.
