import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AiService } from '../../app/core/ai.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css'
})
export class SignupComponent {
  signupForm!: FormGroup;
  loginForm!: FormGroup;

  previewUrl: string | null = null;
  isProcessing = false;
  isUser = true; // 👈 default to signup view

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private aiService: AiService
  ) {
    this.signupForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      gender: ['', Validators.required],
      profilePic: [null, Validators.required]
    });

    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  ngOnInit() {
    // If already logged in (sessionStorage)
    const loggedInUser = sessionStorage.getItem("loggedInUser");
    if (loggedInUser) {
      this.router.navigate(['/home']);
    }
  }

  // Profile pic upload
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.uploadAndEnhance(file);
    }
  }

  async uploadAndEnhance(file: File) {
    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const base64Image = e.target.result;
      this.isProcessing = true;

      try {
        const enhancedPic = await this.aiService.enhanceImage(base64Image);
        this.previewUrl = enhancedPic;
        this.signupForm.patchValue({ profilePic: enhancedPic });
      } catch (err) {
        console.error("AI enhancement failed, using raw image", err);
        this.previewUrl = base64Image;
        this.signupForm.patchValue({ profilePic: base64Image });
      } finally {
        this.isProcessing = false;
      }
    };
    reader.readAsDataURL(file);
  }

  // Signup (store in localStorage list)
  onSubmit() {
    if (this.signupForm.valid) {
      const newUser = this.signupForm.value;

      // Get existing users
      let users = JSON.parse(localStorage.getItem("users") || "[]");

      // Check if email already exists
      if (users.some((u: any) => u.email === newUser.email)) {
        alert("User with this email already exists. Please login.");
        this.isUser = false; // switch to login
        return;
      }

      // Add new user
      users.push(newUser);
      localStorage.setItem("users", JSON.stringify(users));

      // Set as logged in (sessionStorage)
      sessionStorage.setItem("loggedInUser", JSON.stringify(newUser));

      this.router.navigate(['/home']);
    } else {
      alert("Please fill all mandatory fields");
    }
  }

  // Login (check from localStorage)
  onLogin() {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      let users = JSON.parse(localStorage.getItem("users") || "[]");

      const matchedUser = users.find(
        (u: any) => u.email === email && u.password === password
      );

      if (matchedUser) {
        sessionStorage.setItem("loggedInUser", JSON.stringify(matchedUser));
        this.router.navigate(['/home']);
      } else {
        alert("Invalid email or password");
      }
    }
  }
}
