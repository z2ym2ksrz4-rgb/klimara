Pod::Spec.new do |s|
  s.name = 'WidgetBridge'
  s.version = '1.0.0'
  s.summary = 'Widget data bridge for Capacitor apps'
  s.license = 'MIT'
  s.homepage = 'https://ilumie.com/klimara/'
  s.author = 'Ilumie'
  s.source = { :git => 'https://github.com/z2ym2ksrz4-rgb/furkeep.git', :tag => s.version.to_s }
  s.source_files = 'ios/Sources/**/*.{swift,h,m}'
  s.ios.deployment_target = '15.5'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
