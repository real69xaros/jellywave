package com.jellywave.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onPause() {
        super.onPause();
        // Resume the WebView immediately after pause to allow background audio playback.
        // Without this, Android suspends the WebView and audio stops when the screen turns off.
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().onResume();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
    }
}
