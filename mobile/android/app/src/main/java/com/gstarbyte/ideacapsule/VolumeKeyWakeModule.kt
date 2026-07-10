package com.gstarbyte.ideacapsule

import android.accessibilityservice.AccessibilityService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.*

class VolumeKeyWakeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "VolumeKeyWakeModule"

    @ReactMethod
    fun isAccessibilityServiceEnabled(promise: Promise) {
        val context = reactApplicationContext
        val expectedComponentName = ComponentName(context, VolumeKeyWakeService::class.java)
        val enabledServicesSetting = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        )
        
        if (enabledServicesSetting == null) {
            promise.resolve(false)
            return
        }

        var isEnabled = false
        val colonSplitter = TextUtils.SimpleStringSplitter(':')
        colonSplitter.setString(enabledServicesSetting)
        while (colonSplitter.hasNext()) {
            val componentNameString = colonSplitter.next()
            val enabledService = ComponentName.unflattenFromString(componentNameString)
            if (enabledService != null && enabledService == expectedComponentName) {
                isEnabled = true
                break
            }
        }
        promise.resolve(isEnabled)
    }

    @ReactMethod
    fun openAccessibilitySettings() {
        val context = reactApplicationContext
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun setAccessibilityWakeEnabled(enabled: Boolean) {
        val sharedPref = reactApplicationContext.getSharedPreferences("luminote_prefs", Context.MODE_PRIVATE)
        with(sharedPref.edit()) {
            putBoolean("accessibility_wake_enabled", enabled)
            apply()
        }
    }
}
