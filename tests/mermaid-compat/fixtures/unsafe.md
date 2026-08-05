# Unsafe Mermaid

```mermaid
graph TD
    A[Release gate] -->|passes| B[Publish]
    B --> C[retry < 3]
    C --> D[（fallback）]
    D -.->|legacy| E["Archive"]
```
