import ExpoModulesCore
import UIKit

private let hardwareSubmitEventName = "onHardwareKeyboardSubmit"

private weak var activeModule: VincuHardwareKeyboardModule?
private var isHardwareSubmitEnabled = false

@objc
public class VincuHardwareKeyboardReactDelegateHandler: ExpoReactDelegateHandler {
  public override func createRootViewController() -> UIViewController? {
    return VincuHardwareKeyboardRootViewController()
  }
}

public class VincuHardwareKeyboardModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VincuHardwareKeyboard")

    Events(hardwareSubmitEventName)

    OnCreate {
      activeModule = self
    }

    Function("setHardwareKeyboardSubmitEnabled") { (enabled: Bool) in
      DispatchQueue.main.async {
        isHardwareSubmitEnabled = enabled
      }
    }

    OnDestroy {
      if activeModule === self {
        activeModule = nil
      }
      isHardwareSubmitEnabled = false
    }
  }

  fileprivate func emitHardwareKeyboardSubmit() {
    sendEvent(hardwareSubmitEventName, [:])
  }
}

private final class VincuHardwareKeyboardRootViewController: UIViewController {
  override var keyCommands: [UIKeyCommand]? {
    guard isHardwareSubmitEnabled && UIDevice.current.userInterfaceIdiom == .pad else {
      return super.keyCommands
    }

    let command = UIKeyCommand(
      input: "\r",
      modifierFlags: [],
      action: #selector(handleHardwareKeyboardSubmit(_:))
    )
    if #available(iOS 15.0, *) {
      command.wantsPriorityOverSystemBehavior = true
    }
    return (super.keyCommands ?? []) + [command]
  }

  @objc
  private func handleHardwareKeyboardSubmit(_ sender: UIKeyCommand) {
    guard canSubmitCurrentTextInput() else {
      return
    }
    activeModule?.emitHardwareKeyboardSubmit()
  }

  private func canSubmitCurrentTextInput() -> Bool {
    guard let responder = UIResponder.vincuCurrentFirstResponder else {
      return false
    }
    guard let textInput = responder as? UITextInput else {
      return false
    }
    return textInput.markedTextRange == nil
  }
}

private extension UIResponder {
  private static weak var currentFirstResponder: UIResponder?

  static var vincuCurrentFirstResponder: UIResponder? {
    currentFirstResponder = nil
    UIApplication.shared.sendAction(
      #selector(captureCurrentFirstResponder(_:)),
      to: nil,
      from: nil,
      for: nil
    )
    return currentFirstResponder
  }

  @objc
  private func captureCurrentFirstResponder(_ sender: Any?) {
    UIResponder.currentFirstResponder = self
  }
}
