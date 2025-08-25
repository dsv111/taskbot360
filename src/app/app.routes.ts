import { Routes } from '@angular/router';
import { HomeComponent } from '../pages/home/home.component';
import { ChatComponent } from '../pages/chat/chat.component';
import { SignupComponent } from '../pages/signup/signup.component';
import { AuthGuard } from './core/auth.guard';

export const routes: Routes = [
    {path:'',component:HomeComponent},
    {path:'chat',component:ChatComponent, canActivate: [AuthGuard] },
    {path:'login',component:SignupComponent, canActivate: [AuthGuard] },
    { path: '**', redirectTo: '' }

];
