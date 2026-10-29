package app.ilumie.widgetbridge;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
    @PluginMethod
    public void setData(PluginCall call) {
        String json = call.getString("json", "{}");
        String widgetClass = call.getString("widgetClass", null);
        Context ctx = getContext();
        ctx.getSharedPreferences("widget_bridge", Context.MODE_PRIVATE).edit().putString("widgetData", json).apply();
        if (widgetClass != null) {
            try {
                Class<?> cls = Class.forName(widgetClass);
                AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
                int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, cls));
                Intent i = new Intent(ctx, cls);
                i.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
                ctx.sendBroadcast(i);
            } catch (Exception ignored) { }
        }
        call.resolve();
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject();
        try {
            PackageInfo pi = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            r.put("version", pi.versionName);
            r.put("build", String.valueOf(Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode));
        } catch (Exception e) { r.put("version", ""); r.put("build", ""); }
        // Play internal/closed testing installs come from the Play Store too; treat non-release builds as test
        r.put("isTestFlight", false);
        r.put("os", "Android " + Build.VERSION.RELEASE);
        r.put("device", Build.MANUFACTURER + " " + Build.MODEL);
        call.resolve(r);
    }
}
