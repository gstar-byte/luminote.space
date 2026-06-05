package com.gstarbyte.ideacapsule

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.net.Uri
import android.view.KeyEvent
import android.util.Log

class LumiAccessibilityService : AccessibilityService() {

    private var volumeDownDownTime: Long = 0
    private var triggered = false

    override fun onAccessibilityEvent(event: android.view.accessibility.AccessibilityEvent?) {
        // No-op
    }

    override fun onInterrupt() {
        // No-op
    }

    override fun onKeyEvent(event: KeyEvent): Boolean {
        val keyCode = event.keyCode
        val action = event.action

        if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            if (action == KeyEvent.ACTION_DOWN) {
                if (event.repeatCount == 0) {
                    volumeDownDownTime = System.currentTimeMillis()
                    triggered = false
                } else if (!triggered) {
                    val duration = System.currentTimeMillis() - volumeDownDownTime
                    if (duration > 800) { // 800ms considered as long press
                        triggered = true
                        launchQuickCapture()
                        return true // Consume key event
                    }
                }
            } else if (action == KeyEvent.ACTION_UP) {
                if (triggered) {
                    return true // Consume key event
                }
            }
        }
        return super.onKeyEvent(event)
    }

    private fun launchQuickCapture() {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("ideacapsule://quick-capture"))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            startActivity(intent)
            Log.d("LumiAccessibility", "Successfully launched quick-capture via scheme")
        } catch (e: Exception) {
            Log.e("LumiAccessibility", "Error launching scheme", e)
        }
    }
}
