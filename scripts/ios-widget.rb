#!/usr/bin/env ruby
# Adds the WidgetKit extension target to the Xcode project that `cap add ios` generated.
# Run from the repo root after `npx cap sync ios`: ruby scripts/ios-widget.rb
require 'xcodeproj'
require 'fileutils'

APP_ID   = ENV['BUNDLE_ID'] || 'com.ilumie.klimara'
NAME     = 'AttackWidget'
proj_dir = 'ios/App'
proj     = Xcodeproj::Project.open("#{proj_dir}/App.xcodeproj")
app      = proj.targets.find { |t| t.name == 'App' } or abort('App target not found')

# ---- app entitlements (App Group) ------------------------------------------------------------
FileUtils.cp('native/ios/App.entitlements', "#{proj_dir}/App/App.entitlements")
app_group = proj.main_group['App']
app_group.new_file('App/App.entitlements') unless app_group.files.any? { |f| f.path&.end_with?('App.entitlements') }
app.build_configurations.each { |c| c.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements' }

if proj.targets.any? { |t| t.name == NAME }
  puts "#{NAME} already present"; proj.save; exit 0
end

# ---- copy sources ---------------------------------------------------------------------------
FileUtils.mkdir_p("#{proj_dir}/#{NAME}")
Dir.glob("native/ios/#{NAME}/*").each { |f| FileUtils.cp(f, "#{proj_dir}/#{NAME}/") }

# ---- target ---------------------------------------------------------------------------------
target = proj.new_target(:app_extension, NAME, :ios, '16.0')
group  = proj.main_group.new_group(NAME, NAME)
swift  = group.new_file("#{NAME}.swift")
group.new_file('Info.plist'); group.new_file("#{NAME}.entitlements")
target.add_file_references([swift])
%w[WidgetKit SwiftUI].each { |fw| target.add_system_framework(fw) }

marketing = app.build_configurations.first.build_settings['MARKETING_VERSION'] || '1.0'
current   = app.build_configurations.first.build_settings['CURRENT_PROJECT_VERSION'] || '1'
target.build_configurations.each do |c|
  bs = c.build_settings
  bs['PRODUCT_BUNDLE_IDENTIFIER'] = "#{APP_ID}.widget"
  bs['PRODUCT_NAME'] = NAME
  bs['INFOPLIST_FILE'] = "#{NAME}/Info.plist"
  bs['GENERATE_INFOPLIST_FILE'] = 'NO'
  bs['CODE_SIGN_ENTITLEMENTS'] = "#{NAME}/#{NAME}.entitlements"
  bs['SWIFT_VERSION'] = '5.0'
  bs['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
  bs['TARGETED_DEVICE_FAMILY'] = '1'
  bs['SKIP_INSTALL'] = 'YES'
  bs['MARKETING_VERSION'] = marketing
  bs['CURRENT_PROJECT_VERSION'] = current
  bs['LD_RUNPATH_SEARCH_PATHS'] = '$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks'
  bs['ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME'] = 'WidgetBackground'
  bs['SWIFT_EMIT_LOC_STRINGS'] = 'YES'
  bs['CODE_SIGN_STYLE'] = app.build_configurations.first.build_settings['CODE_SIGN_STYLE'] || 'Automatic'
  bs['DEVELOPMENT_TEAM'] = app.build_configurations.first.build_settings['DEVELOPMENT_TEAM'] if app.build_configurations.first.build_settings['DEVELOPMENT_TEAM']
end

# ---- embed in app ---------------------------------------------------------------------------
app.add_dependency(target)
embed = app.copy_files_build_phases.find { |p| p.name == 'Embed Foundation Extensions' } || app.new_copy_files_build_phase('Embed Foundation Extensions')
embed.dst_subfolder_spec = '13' # PlugIns
bf = embed.add_file_reference(target.product_reference, true)
bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

proj.save
puts "Added #{NAME} (#{APP_ID}.widget)"
