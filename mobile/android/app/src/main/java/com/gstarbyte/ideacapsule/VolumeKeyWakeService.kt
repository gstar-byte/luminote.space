package com.gstarbyte.ideacapsule

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent

class VolumeKeyWakeService : AccessibilityService() {

    private val handler = Handler(Looper.getMainLooper())
    private var isLongPressTriggered = false
    private var currentRunnable: Runnable? = null

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        // 无需处理常规无障碍事件
    }

    override fun onInterrupt() {
        // 服务中断
    }

    override fun onKeyEvent(event: KeyEvent): Boolean {
        // 读取 SharedPreferences 确认是否开启音量键唤醒设置
        val sharedPref = getSharedPreferences("luminote_prefs", Context.MODE_PRIVATE)
        val isEnabled = sharedPref.getBoolean("accessibility_wake_enabled", false)
        if (!isEnabled) {
            return false
        }

        val keyCode = event.keyCode
        val action = event.action

        // 我们只监听音量下键
        if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            if (action == KeyEvent.ACTION_DOWN) {
                if (event.repeatCount == 0) {
                    isLongPressTriggered = false
                    // 移除旧的以防冲突
                    currentRunnable?.let { handler.removeCallbacks(it) }

                    val runnable = Runnable {
                        isLongPressTriggered = true
                        triggerWakeUp()
                    }
                    currentRunnable = runnable
                    // 900毫秒判定为长按
                    handler.postDelayed(runnable, 900)
                } else {
                    // 如果长按已经触发，拦截后续的连击，防止音量继续降到零
                    if (isLongPressTriggered) {
                        return true
                    }
                }
            } else if (action == KeyEvent.ACTION_UP) {
                currentRunnable?.let {
                    handler.removeCallbacks(it)
                    currentRunnable = null
                }
                if (isLongPressTriggered) {
                    isLongPressTriggered = false
                    return true // 拦截 UP 事件
                }
            }
        }

        return false
    }

    private fun triggerWakeUp() {
        // 振动反馈
        performHapticFeedback()

        // 启动主 Activity 的 Deep Link 唤醒
        try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("luminote://quick-capture")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun performHapticFeedback() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            val vibrator = vibratorManager?.defaultVibrator
            vibrator?.vibrate(VibrationEffect.createOneShot(80, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            @Suppress("DEPRECATION")
            vibrator?.vibrate(80)
        }
    }
}
