use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()

        // Launch at login support.
        // When macOS launches SmartStickies automatically,
        // it will pass --hidden so the window does not pop up.
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .arg("--hidden")
                .build()
        )

        // Existing plugins
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())

        // If SmartStickies was launched automatically
        // at login, start with the main window hidden.
        .setup(|app| {
            let launched_hidden =
                std::env::args()
                    .any(|arg| arg == "--hidden");

            if launched_hidden {
                if let Some(window) =
                    app.get_webview_window("main")
                {
                    window.hide()?;
                }
            }

            Ok(())
        })

        // Clicking the red Mac close button should
        // hide SmartStickies instead of destroying it.
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            if let tauri::WindowEvent::CloseRequested {
                api,
                ..
            } = event
            {
                api.prevent_close();

                let _ = window.hide();
            }
        })

        .invoke_handler(
            tauri::generate_handler![greet]
        )

        .build(
            tauri::generate_context!()
        )

        .expect(
            "error while building tauri application"
        );

    app.run(|app_handle, event| {

        // macOS:
        // if SmartStickies is hidden and the user
        // clicks its Dock icon, show the window again.
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen {
            has_visible_windows: false,
            ..
        } = event
        {
            if let Some(window) =
                app_handle.get_webview_window("main")
            {
                let _ =
                    window.show();

                let _ =
                    window.set_focus();
            }
        }
    });
}