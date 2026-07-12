# Review Notes — /code-review + /security-review (2026-07-09)

Không có diff pending giữa `develop` và `main`, nên review được chạy trên toàn bộ `src/` hiện tại (không phải một PR diff). 4 việc cần xử lý, xếp theo mức độ nghiêm trọng.

> **Cập nhật:** cả 4 finding bên dưới đã được fix trong code (xem diff). Build + typecheck + toàn bộ test suite (16/16) đều pass. Giữ lại nội dung gốc để tham khảo lý do/kịch bản.

## 1. [HIGH] [FIXED] Poll cycle re-fetch toàn bộ issue trong ngày, có thể "đói" update mới ở project bận
**File:** `src/redmine/client.ts:66` (`toRedmineDate`), `src/poller.ts:45` (`offset`)

Redmine REST API chỉ filter `updated_on` theo độ chính xác **ngày** (không có giờ). `toRedmineDate()` cắt timestamp về `YYYY-MM-DD`, nên mỗi lần poll (mặc định 30–60s) đều liệt kê lại **toàn bộ issue đã update từ 00:00 hôm đó**, không chỉ từ watermark lần trước. `offset` reset về 0 mỗi lần gọi `pollProject`, nên nó luôn quét lại từ issue cũ nhất trước.

Việc "đã xử lý rồi" chỉ được phát hiện **sau khi** gọi `getIssueWithJournals` (tốn 1 API call thật), nên với project có nhiều hơn `MAX_ISSUE_DETAIL_REQUESTS_PER_CYCLE` (mặc định 200) issue thay đổi trong 1 ngày, cycle nào cũng đốt hết quota vào việc re-fetch issue cũ đã xử lý, và issue mới có thể bị trì hoãn/không bao giờ được xử lý trong ngày đó.

**Gợi ý fix:** dùng `issueState.lastSeenUpdatedOn` (đã lưu sẵn trong `issues_state`) để skip re-fetch detail cho issue chưa đổi kể từ lần thấy gần nhất, trước khi gọi `getIssueWithJournals`.

## 2. [HIGH] [FIXED] Notification status/assignee/priority hiển thị ID số thô, không phải tên
**File:** `src/discord/formatter.ts:46`, `src/detection/eventDetector.ts:113-115`

Redmine API không resolve `status_id` / `priority_id` / `assigned_to_id` trong journal details thành tên — chỉ trả về ID nội bộ. Code hiện tại pass thẳng `old_value`/`new_value` vào Discord embed:
```
value: `${event.oldValue ?? "(empty)"} -> ${event.newValue ?? "(empty)"}`
```
→ Discord sẽ hiện `"3 -> 5"` thay vì `"New -> In Progress"` cho **3/5 loại event** (status_changed, assignee_changed, priority_changed). Test hiện tại (`tests/eventDetector.test.ts`) chỉ assert `eventType`, không assert giá trị hiển thị, nên bug này không bị test bắt.

**Gợi ý fix:** gọi thêm Redmine API để cache map ID→tên cho statuses (`/statuses.json`), priorities (`/enumerations/issue_priorities.json`), users (`/users/{id}.json` hoặc cache từ `assigned_to`/`author` đã có sẵn trong issue payload) rồi resolve trước khi format.

## 3. [MEDIUM] [FIXED] Một project lỗi có thể làm crash toàn bộ service
**File:** `src/poller.ts:37-40`

Guard clause `throw new Error("Project is not initialized...")` nằm **ngoài** try/catch của `pollProject` (try bắt đầu ở dòng sau). Mọi lỗi khác trong hàm này đều được catch và ghi vào `failPoll` (chỉ fail 1 project), nhưng throw này thì không — nó sẽ lan ra `pollOnce()` → main loop → `main().catch()` → set `process.exitCode = 1` → **dừng toàn bộ service**, ảnh hưởng tất cả project đang cấu hình, không chỉ project bị lỗi.

Hiện tại đường này gần như unreachable (vì `initializeProjects()` luôn init hết project trước khi vào loop poll), nhưng nó là điểm yếu thiết kế: nếu sau này có state row bị ghi thiếu (migration, sửa DB tay, bug khác), one bad project = toàn bộ service down.

**Gợi ý fix:** đưa check này vào trong try/catch, hoặc catch riêng ở `pollOnce()`/`pollProject()` để skip + log project đó thay vì throw ra ngoài.

## 4. [MEDIUM] [FIXED] Security: Nội dung issue/comment từ Redmine được nhúng thẳng vào Discord embed, có thể bị lợi dụng để phishing
**File:** `src/discord/formatter.ts:36,57` (dữ liệu từ `src/detection/eventDetector.ts:38-39,58-59`)

`issue.subject` và `journal.notes` — do bất kỳ user Redmine nào tạo issue/comment được trên project đang theo dõi — được đưa thẳng vào Discord embed (field value và description) không escape. Discord embed hỗ trợ markdown kể cả masked link `[text](url)`. Payload dùng `username: "Redmine"`, nên message hiện ra như một thông báo chính thức từ bot đáng tin cậy.

**Kịch bản khai thác:** user Redmine (reporter ngoài, khách hàng, hoặc bất kỳ ai có quyền comment) đặt subject/comment dạng:
`Thanh toán lỗi — [Bấm vào đây để xác nhận](https://phish.example.com)`
→ Discord render thành link có thể click ngay trong embed "New Redmine comment", trông giống thông báo hợp lệ từ bot. Đây là pattern phishing đã biết với bot relay nội dung user vào Slack/Discord/Teams.

**Gợi ý fix:** escape các ký tự markdown đặc biệt của Discord (`[ ] ( ) * _ ~ \` |`) trong `issueSubject`, `notes`, `authorName`, `oldValue`/`newValue` trước khi build payload, hoặc bọc nội dung user-controlled trong code span.

---

## Ghi chú vận hành (không phải finding chính thức, nhưng nên biết)

File `.env` hiện tại trong workspace chứa **Redmine API key và Discord webhook URL thật** (không phải placeholder). File này **không** bị track bởi git (`.gitignore` có `.env`, đã kiểm tra lịch sử git — chưa từng bị commit), nên không có rò rỉ qua repo. Chỉ cần đảm bảo không share file này ra ngoài (chat, screenshot, upload nhầm...). Nếu nghi ngờ đã lộ, nên rotate cả Redmine API key và Discord webhook.
